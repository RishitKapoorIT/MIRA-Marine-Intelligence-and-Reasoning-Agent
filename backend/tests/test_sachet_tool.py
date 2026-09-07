from app.tools.sachet_tool import parse_cap_alert

CAP = '''<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>NDMA-IMD-2026-09-08-001</identifier>
  <sender>ndma@gov.in</sender>
  <sent>2026-09-08T06:00:00+05:30</sent>
  <info>
    <language>en-IN</language>
    <event>Cyclonic Storm</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <senderName>India Meteorological Department</senderName>
    <headline>Cyclonic storm warning for Karnataka coast</headline>
    <description>Squally weather with wind speed reaching 60 kmph very likely.</description>
    <instruction>Fishermen are advised not to venture into the sea.</instruction>
    <onset>2026-09-08T12:00:00+05:30</onset>
    <effective>2026-09-08T06:00:00+05:30</effective>
    <expires>2026-09-09T06:00:00+05:30</expires>
    <area>
      <areaDesc>Karnataka coastal districts</areaDesc>
      <polygon>12.0,74.0 12.0,75.0 13.0,75.0 13.0,74.0 12.0,74.0</polygon>
    </area>
  </info>
</alert>'''

p = parse_cap_alert(CAP)
assert p['cap_identifier'] == 'NDMA-IMD-2026-09-08-001'
assert p['severity'].value == 'Severe'
assert p['urgency'].value == 'Immediate'
assert p['certainty'].value == 'Likely'
assert p['original_language'] == 'en'
assert p['originating_agency'] == 'India Meteorological Department'
assert p['area_wkt'].startswith('MULTIPOLYGON(((74.0 12.0'), p['area_wkt']
assert p['expires_at'].isoformat() == '2026-09-09T06:00:00+05:30'
print('valid CAP parsed, all fields correct')
print('  area_wkt:', p['area_wkt'])

assert parse_cap_alert('<not-xml') is None
assert parse_cap_alert('<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><info/></alert>') is None
print('unparseable / identifier-less documents rejected')

no_poly = CAP.replace('<polygon>12.0,74.0 12.0,75.0 13.0,75.0 13.0,74.0 12.0,74.0</polygon>', '')
p2 = parse_cap_alert(no_poly)
assert p2 is not None and p2['area_wkt'] is None
assert p2['area_description'] == 'Karnataka coastal districts'
print('alert with unparseable geometry retained, not discarded')

weird = CAP.replace('<severity>Severe</severity>', '<severity>Catastrophic</severity>')
assert parse_cap_alert(weird)['severity'].value == 'Unknown'
print('unrecognised severity -> Unknown (no crash)')
print()
print('CAP PARSE PASSED')