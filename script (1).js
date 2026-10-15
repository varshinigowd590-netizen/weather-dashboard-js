// Open-Meteo: free public REST APIs, no API key required
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const statusEl = document.getElementById("status");
const weatherEl = document.getElementById("weather");
const button = form.querySelector("button");

// WMO weather codes -> readable text
const WEATHER_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm"
};

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

// Generic fetch helper with HTTP error handling
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (HTTP ${response.status})`);
  }
  return response.json();
}

// Step 1: city name -> coordinates
async function getCoordinates(city) {
  const data = await fetchJSON(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1`);
  if (!data.results || data.results.length === 0) {
    throw new Error(`City "${city}" not found. Check the spelling and try again.`);
  }
  const { latitude, longitude, name, country, admin1 } = data.results[0];
  return { latitude, longitude, label: [name, admin1, country].filter(Boolean).join(", ") };
}

// Step 2: coordinates -> weather (nested JSON)
async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5
  });
  return fetchJSON(`${WEATHER_URL}?${params}`);
}

function render(label, data) {
  const { current, current_units: u, daily } = data;

  document.getElementById("location").textContent = label;
  document.getElementById("condition").textContent = WEATHER_CODES[current.weather_code] || "Unknown";
  document.getElementById("temp").textContent = `${current.temperature_2m}${u.temperature_2m}`;
  document.getElementById("feels").textContent = `${current.apparent_temperature}${u.apparent_temperature}`;
  document.getElementById("humidity").textContent = `${current.relative_humidity_2m}${u.relative_humidity_2m}`;
  document.getElementById("wind").textContent = `${current.wind_speed_10m} ${u.wind_speed_10m}`;

  const forecast = document.getElementById("forecast");
  forecast.innerHTML = "";
  daily.time.forEach((date, i) => {
    const day = document.createElement("div");
    day.className = "day";
    const name = new Date(date).toLocaleDateString(undefined, { weekday: "short" });
    day.innerHTML = `<strong>${name}</strong>
      <div>${WEATHER_CODES[daily.weather_code[i]] || ""}</div>
      <div>${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</div>`;
    forecast.appendChild(day);
  });

  weatherEl.classList.remove("hidden");
}

async function search(city) {
  setStatus("Loading...");
  button.disabled = true;
  weatherEl.classList.add("hidden");
  try {
    const { latitude, longitude, label } = await getCoordinates(city);
    const data = await getWeather(latitude, longitude);
    render(label, data);
    setStatus("");
    localStorage.setItem("lastCity", city);
  } catch (error) {
    // fetch() rejects with TypeError on network failure
    const message = error instanceof TypeError
      ? "Network error. Check your internet connection and try again."
      : error.message;
    setStatus(message, true);
  } finally {
    button.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const city = input.value.trim();
  if (city) search(city);
});

// Reload the last searched city
const last = localStorage.getItem("lastCity");
if (last) {
  input.value = last;
  search(last);
}
