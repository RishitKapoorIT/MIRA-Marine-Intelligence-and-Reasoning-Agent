import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional

class DatasetAnalyzer:
    """
    Analyzes the fishing zone dataset to extract empirical statistical ranges,
    distributions, and physical constraints.
    """
    def __init__(self, csv_path: str = "final_fishing_zone_ML_with_chlorophyll.csv"):
        self.csv_path = csv_path
        self.df = pd.read_csv(csv_path)
        self.stats = self._compute_statistics()

    def _compute_statistics(self) -> Dict[str, Dict[str, float]]:
        stats_dict = {}
        num_cols = ['YEAR', 'latitude', 'longitude', 'month', 'temperature', 
                    'salinity', 'eastward_current', 'northward_current', 
                    'current_speed', 'chlorophyll']
        
        for col in num_cols:
            if col in self.df.columns:
                series = self.df[col]
                stats_dict[col] = {
                    "min": float(series.min()),
                    "max": float(series.max()),
                    "mean": float(series.mean()),
                    "std": float(series.std()),
                    "p25": float(series.quantile(0.25)),
                    "median": float(series.median()),
                    "p75": float(series.quantile(0.75))
                }
        return stats_dict

    def get_summary(self) -> Dict[str, Any]:
        return {
            "total_records": len(self.df),
            "target_distribution": self.df['fishing_zone'].value_counts().to_dict(),
            "feature_statistics": self.stats
        }


class EnvironmentalFeatureGenerator:
    """
    Generates realistic oceanographic environmental features for given lat/long coordinates
    adhering strictly to dataset statistics and physical constraints.
    """
    def __init__(self, analyzer: Optional[DatasetAnalyzer] = None):
        if analyzer is None:
            analyzer = DatasetAnalyzer()
        self.analyzer = analyzer
        self.stats = analyzer.stats

    def _truncated_normal(self, mean: float, std: float, low: float, high: float) -> float:
        """Helper to sample from a truncated normal distribution."""
        val = np.random.normal(mean, std)
        return float(np.clip(val, low, high))

    def generate_single_sample(
        self, 
        latitude: float, 
        longitude: float, 
        year: Optional[int] = None, 
        month: Optional[int] = None
    ) -> Dict[str, float]:
        """
        Generates 10 environmental features for a given coordinate.
        Current speed is calculated physically as sqrt(eastward^2 + northward^2).
        """
        # Year constraint: 2020-2026 (default random choice from dataset or requested year)
        if year is None:
            year = int(np.random.choice([2020, 2021, 2022, 2023, 2024]))
        
        # Month constraint: 1-12
        if month is None:
            month = int(np.random.randint(1, 13))

        # Temperature (°C)
        t_stat = self.stats['temperature']
        temperature = self._truncated_normal(
            t_stat['mean'], t_stat['std'], t_stat['min'], t_stat['max']
        )

        # Salinity (PSU)
        s_stat = self.stats['salinity']
        salinity = self._truncated_normal(
            s_stat['mean'], s_stat['std'], s_stat['min'], s_stat['max']
        )

        # Eastward current u (m/s)
        u_stat = self.stats['eastward_current']
        eastward_current = self._truncated_normal(
            u_stat['mean'], u_stat['std'], u_stat['min'], u_stat['max']
        )

        # Northward current v (m/s)
        v_stat = self.stats['northward_current']
        northward_current = self._truncated_normal(
            v_stat['mean'], v_stat['std'], v_stat['min'], v_stat['max']
        )

        # Current speed (m/s) - exact physical constraint: s = sqrt(u^2 + v^2)
        current_speed = float(np.sqrt(eastward_current**2 + northward_current**2))

        # Chlorophyll (mg/m^3) - lognormal distribution matching dataset shape
        c_stat = self.stats['chlorophyll']
        # Sample with exponential decay to model realistic ocean surface concentration with occasional coastal blooms
        raw_chlo = np.random.lognormal(mean=np.log(c_stat['median']), sigma=0.4)
        chlorophyll = float(np.clip(raw_chlo, c_stat['min'], c_stat['max']))

        return {
            "YEAR": float(year),
            "latitude": float(latitude),
            "longitude": float(longitude),
            "month": float(month),
            "temperature": round(temperature, 4),
            "salinity": round(salinity, 4),
            "eastward_current": round(eastward_current, 6),
            "northward_current": round(northward_current, 6),
            "current_speed": round(current_speed, 6),
            "chlorophyll": round(chlorophyll, 6)
        }

    def generate_batch(
        self, 
        coordinates: List[Dict[str, float]], 
        year: Optional[int] = None, 
        month: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Generates feature records for a batch of coordinates (e.g. 20 lat/long inputs).
        Returns a pandas DataFrame matching model expected columns.
        """
        records = []
        for coord in coordinates:
            lat = coord.get("latitude")
            lon = coord.get("longitude")
            if lat is None or lon is None:
                raise ValueError("Each coordinate dict must contain 'latitude' and 'longitude'.")
            
            sample = self.generate_single_sample(latitude=lat, longitude=lon, year=year, month=month)
            records.append(sample)
        
        df_batch = pd.DataFrame(records)
        
        # Ensure column order matches training dataset
        expected_cols = [
            'YEAR', 'latitude', 'longitude', 'month', 'temperature',
            'salinity', 'eastward_current', 'northward_current',
            'current_speed', 'chlorophyll'
        ]
        return df_batch[expected_cols]


if __name__ == "__main__":
    analyzer = DatasetAnalyzer()
    generator = EnvironmentalFeatureGenerator(analyzer)
    
    # Test batch of 20 coordinates
    sample_coords = [
        {"latitude": round(np.random.uniform(0.5, 24.0), 4), 
         "longitude": round(np.random.uniform(61.0, 98.0), 4)} 
        for _ in range(20)
    ]
    df_gen = generator.generate_batch(sample_coords)
    print("Generated Batch Shape:", df_gen.shape)
    print(df_gen.head(3))
