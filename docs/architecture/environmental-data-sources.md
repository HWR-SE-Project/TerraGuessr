# Environmental data sources

## Weather: Open-Meteo

- **Provider:** Open-Meteo Forecast API (`api.open-meteo.com/v1/forecast`).
- **Variable reference:** [Forecast API documentation](https://open-meteo.com/en/docs) defines the selected variables and units; `timezone=auto` resolves the location time zone.
- **Coverage:** forecast/model output for requested coordinates; products and availability vary by region and model. It is not a ground-station observation guarantee.
- **Freshness:** TerraGuessr stores a snapshot for up to one hour. The provider's current value is model-derived and may itself lag its latest model cycle.
- **Fields:** temperature (°C), precipitation (mm), relative humidity (%), wind speed (km/h), surface pressure (hPa), 10 m wind direction (degrees clockwise from north), UV index, daily sunshine duration (seconds, shown as hours), and provider-local current time. Pressure, direction, UV, sunshine duration and local time are optional; a missing provider value is displayed as unavailable and does not prevent play.
- **Attribution and license:** displayed weather links to Open-Meteo. Open-Meteo states that API data are CC BY 4.0 and requires attribution next to displayed location data. [License](https://open-meteo.com/en/license).
- **Cost and permitted use:** this application currently calls the free/open-access endpoint without an API key. Open-Meteo's terms restrict that endpoint to non-commercial use and state request limits; a commercial product needs a commercial subscription/endpoint. No paid service has been enabled. Confirm the deployment's use category before production use. [Terms and plans](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing).
- **Failure behavior:** base weather remains subject to the existing bounded retry, location fallback, and unavailable response. Optional metrics do not gate round creation. The UI groups UV, daily sunshine duration and local time in a collapsed “Sun & local time” panel.

## Not integrated

Aviation, air/light pollution, astronomical sun position, earthquakes, and location imagery have no configured provider in this release. The game must not infer or fabricate those measurements. Provider selection requires a separate coverage, freshness, licensing, and cost review before implementation.
