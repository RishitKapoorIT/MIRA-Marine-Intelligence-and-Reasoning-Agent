import os
import pickle
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generator import DatasetAnalyzer, EnvironmentalFeatureGenerator

# Robust absolute paths relative to current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_skin_fishing_model.pkl")
CSV_PATH = os.path.join(BASE_DIR, "final_fishing_zone_ML_with_chlorophyll.csv")

LABEL_MAP = {0: "BEST", 1: "GOOD", 2: "POOR"}

model = None
analyzer = None
generator = None


def load_resources():
    global model, analyzer, generator
    if model is None or analyzer is None or generator is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(f"Model file {MODEL_PATH} not found!")
        if not os.path.exists(CSV_PATH):
            raise RuntimeError(f"CSV file {CSV_PATH} not found!")
        
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        
        analyzer = DatasetAnalyzer(CSV_PATH)
        generator = EnvironmentalFeatureGenerator(analyzer)
        print(f"XGBoost Model & Dataset Analyzer loaded successfully from {BASE_DIR}.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_resources()
    yield


# Initialize FastAPI App
app = FastAPI(
    title="Potential Fishing Zone (PFZ) Machine Learning API",
    description="API for predicting Potential Fishing Zones (BEST, GOOD, POOR) based on input lat/long coordinates with oceanographic feature synthesis.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Eagerly load on startup
load_resources()

# Setup Templates directory
templates_dir = os.path.join(BASE_DIR, "templates")
if not os.path.exists(templates_dir):
    os.makedirs(templates_dir)

templates = Jinja2Templates(directory=templates_dir)


# Pydantic Request Models
class CoordinateItem(BaseModel):
    latitude: float = Field(..., example=10.542, description="Latitude in degrees (-90 to 90)")
    longitude: float = Field(..., example=76.214, description="Longitude in degrees (-180 to 180)")

class BatchCoordinatesRequest(BaseModel):
    coordinates: List[CoordinateItem] = Field(
        ..., 
        description="List of coordinates (typically 12-20 input lat/long pairs)",
        min_items=1,
        max_items=100
    )
    year: Optional[int] = Field(None, example=2024, description="Optional target year (2020-2026)")
    month: Optional[int] = Field(None, example=6, description="Optional target month (1-12)")

from datetime import datetime

class CustomFeatureItem(BaseModel):
    latitude: float
    longitude: float
    temperature: float
    salinity: float
    eastward_current: float
    northward_current: float
    chlorophyll: Optional[float] = None

class BatchCustomRequest(BaseModel):
    items: list[CustomFeatureItem]

@app.post("/api/v1/predict/batch_custom")
def predict_batch_custom(req: BatchCustomRequest):
    # Get current year and month to satisfy the model's 10-feature requirement
    current_year = float(datetime.utcnow().year)
    current_month = float(datetime.utcnow().month)

    rows = []
    for it in req.items:
        # Calculate current_speed if needed
        speed = float(np.sqrt(it.eastward_current**2 + it.northward_current**2))
        
        # Build the 10-feature row in the EXACT order the model expects
        # (Assuming the order: YEAR, latitude, longitude, month, temperature, salinity, eastward_current, northward_current, current_speed, chlorophyll)
        rows.append([
            current_year,
            it.latitude,
            it.longitude,
            current_month,
            it.temperature,
            it.salinity,
            it.eastward_current,
            it.northward_current,
            speed,
            np.nan if it.chlorophyll is None else it.chlorophyll
        ])

    # Convert to NumPy array and predict
    X = np.array(rows, dtype=float)
    
    # Optional: Re-align columns safely if your model has 'feature_names_in_'
    if hasattr(model, 'feature_names_in_'):
        df = pd.DataFrame(X, columns=['YEAR', 'latitude', 'longitude', 'month', 'temperature', 'salinity', 'eastward_current', 'northward_current', 'current_speed', 'chlorophyll'])
        X = df[model.feature_names_in_].to_numpy()

    labels = model.predict(X)
    probs = model.predict_proba(X)

    return {"predictions": [
        {"predicted_zone": str(label), "confidence": float(p.max())}
        for label, p in zip(labels, probs)
    ]}

# API Endpoints
@app.get("/health", summary="Health Check")
def health_check():
    return {
        "status": "online",
        "model_loaded": model is not None,
        "model_type": str(type(model)),
        "expected_features": list(getattr(model, "feature_names_in_", []))
    }


@app.get("/api/v1/dataset-stats", summary="Get Dataset Statistics & Constraints")
def get_dataset_stats():
    if analyzer is None:
        raise HTTPException(status_code=500, detail="Analyzer not initialized")
    return analyzer.get_summary()


@app.post("/api/v1/predict/batch_coords", summary="Predict Fishing Zones for Lat/Long Inputs")
def predict_batch_coords(request_data: BatchCoordinatesRequest):
    if model is None or generator is None:
        raise HTTPException(status_code=500, detail="Model or Generator not loaded.")
    
    coords_dicts = [{"latitude": c.latitude, "longitude": c.longitude} for c in request_data.coordinates]
    
    # 1. Generate full 10-feature matrix using empirical dataset distributions & physical constraints
    try:
        df_features = generator.generate_batch(
            coords_dicts, 
            year=request_data.year, 
            month=request_data.month
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Feature generation error: {str(e)}")

    # 2. Re-order columns to match model's expected inputs
    expected_cols = getattr(model, "feature_names_in_", df_features.columns.tolist())
    df_input = df_features[expected_cols]

    # 3. Model Inference
    raw_preds = model.predict(df_input)
    raw_probas = model.predict_proba(df_input) if hasattr(model, "predict_proba") else None

    # 4. Format structured response
    results = []
    zone_counts = {"BEST": 0, "GOOD": 0, "POOR": 0}

    for idx, row in df_features.iterrows():
        pred_class_int = int(raw_preds[idx])
        pred_label = LABEL_MAP.get(pred_class_int, f"CLASS_{pred_class_int}")
        zone_counts[pred_label] = zone_counts.get(pred_label, 0) + 1

        proba_dict = {}
        if raw_probas is not None:
            for c_int, c_label in LABEL_MAP.items():
                proba_dict[c_label] = round(float(raw_probas[idx][c_int]), 4)
            confidence = round(float(np.max(raw_probas[idx])) * 100, 2)
        else:
            confidence = 100.0

        results.append({
            "input_id": idx + 1,
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "predicted_zone": pred_label,
            "confidence_percent": confidence,
            "class_probabilities": proba_dict,
            "features_generated": {
                "YEAR": int(row["YEAR"]),
                "month": int(row["month"]),
                "temperature": round(float(row["temperature"]), 2),
                "salinity": round(float(row["salinity"]), 2),
                "eastward_current": round(float(row["eastward_current"]), 4),
                "northward_current": round(float(row["northward_current"]), 4),
                "current_speed": round(float(row["current_speed"]), 4),
                "chlorophyll": round(float(row["chlorophyll"]), 4)
            }
        })

    return {
        "status": "success",
        "total_inputs": len(results),
        "zone_summary": zone_counts,
        "predictions": results
    }


@app.post("/api/v1/predict/single_custom", summary="Predict for Custom Feature Inputs")
def predict_single_custom(item: CustomFeatureItem):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded.")
    
    dict_data = item.dict()
    if dict_data.get("current_speed") is None:
        dict_data["current_speed"] = float(np.sqrt(dict_data["eastward_current"]**2 + dict_data["northward_current"]**2))

    df_single = pd.DataFrame([dict_data])
    expected_cols = getattr(model, "feature_names_in_", df_single.columns.tolist())
    df_single = df_single[expected_cols]

    pred_class_int = int(model.predict(df_single)[0])
    pred_label = LABEL_MAP.get(pred_class_int, f"CLASS_{pred_class_int}")

    probas = {}
    if hasattr(model, "predict_proba"):
        p = model.predict_proba(df_single)[0]
        for c_int, c_label in LABEL_MAP.items():
            probas[c_label] = round(float(p[c_int]), 4)

    return {
        "latitude": item.latitude,
        "longitude": item.longitude,
        "predicted_zone": pred_label,
        "probabilities": probas,
        "input_features": dict_data
    }


# Web UI Dashboard Route
@app.get("/", response_class=HTMLResponse, summary="Interactive Web Dashboard")
def render_dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
