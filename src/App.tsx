import { useState, useEffect } from 'react';
import { Search, MapPin, Droplets, Wind, Gauge, Eye, Sunrise, Sunset, Sun, Moon, Cloud, CloudRain, CloudSnow, X } from 'lucide-react';

interface WeatherData {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  visibility: number;
  sys: {
    sunrise: number;
    sunset: number;
  };
}

interface HourlyForecast {
  dt: number;
  temp: number;
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  pop: number;
}

interface DailyForecast {
  dt: number;
  temp: {
    min: number;
    max: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  pop: number;
}

declare global {
  interface Window {
    google: any;
  }
}

function App() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [searchCity, setSearchCity] = useState('');
  const [currentCity, setCurrentCity] = useState('Chennai');
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[]>([]);
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [recentCities, setRecentCities] = useState<string[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const API_KEY = '165a4fb76ef2c1da55986b2af224cc0d';

  useEffect(() => {
    loadRecentCities();
    fetchWeather('Chennai');
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showMapModal && lat && lon) {
      setTimeout(() => initializeMap(), 100);
    }
  }, [showMapModal, lat, lon]);

  const loadRecentCities = () => {
    const stored = localStorage.getItem('recentCities');
    if (stored) {
      setRecentCities(JSON.parse(stored));
    }
  };

  const addRecentCity = (city: string) => {
    const updated = [city, ...recentCities.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
    setRecentCities(updated);
    localStorage.setItem('recentCities', JSON.stringify(updated));
  };

  const fetchWeatherByCoords = async (latitude: number, longitude: number) => {
    setLoading(true);
    setLocationLoading(false);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      if (response.ok) {
        setWeatherData(data);
        setCurrentCity(data.name);
        setLat(data.coord.lat);
        setLon(data.coord.lon);
        addRecentCity(data.name);
        fetchForecast(data.coord.lat, data.coord.lon);
      } else {
        alert('Unable to fetch weather for your location');
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      alert('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      (error) => {
        setLocationLoading(false);
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location. Please enable location services.');
      }
    );
  };

  const initializeMap = () => {
    if (!window.google || !lat || !lon) return;

    const mapElement = document.getElementById('weather-map');
    if (!mapElement) return;

    const map = new window.google.maps.Map(mapElement, {
      center: { lat, lng: lon },
      zoom: 10,
      mapTypeId: 'hybrid',
      tilt: 45,
      rotateControl: true,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    setMapInstance(map);

    const marker = new window.google.maps.Marker({
      position: { lat, lng: lon },
      map,
      title: currentCity,
      animation: window.google.maps.Animation.DROP,
    });

    setMapMarkers([marker]);

    map.addListener('click', (event: any) => {
      handleMapClick(event.latLng, map);
    });
  };

  const handleMapClick = async (latLng: any, map: any) => {
    const clickedLat = latLng.lat();
    const clickedLng = latLng.lng();

    mapMarkers.forEach(marker => marker.setMap(null));

    const newMarker = new window.google.maps.Marker({
      position: { lat: clickedLat, lng: clickedLng },
      map,
      animation: window.google.maps.Animation.BOUNCE,
    });

    setTimeout(() => {
      newMarker.setAnimation(null);
    }, 2000);

    setMapMarkers([newMarker]);

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: clickedLat, lng: clickedLng } },
        async (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            let cityName = '';

            for (const component of results[0].address_components) {
              if (component.types.includes('locality')) {
                cityName = component.long_name;
                break;
              }
              if (component.types.includes('administrative_area_level_2')) {
                cityName = component.long_name;
              }
              if (!cityName && component.types.includes('administrative_area_level_1')) {
                cityName = component.long_name;
              }
            }

            if (cityName) {
              newMarker.setTitle(cityName);

              const infoWindow = new window.google.maps.InfoWindow({
                content: `<div style="padding: 8px;"><strong>${cityName}</strong><br/>Loading weather...</div>`,
              });
              infoWindow.open(map, newMarker);

              await fetchWeatherByCoords(clickedLat, clickedLng);

              setTimeout(() => {
                infoWindow.close();
              }, 3000);
            } else {
              alert('Unable to identify city at this location. Please try clicking on a city or town.');
            }
          } else {
            alert('Unable to get location information. Please try another location.');
          }
        }
      );
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Failed to get location details');
    }
  };

  const fetchWeather = async (city: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      if (response.ok) {
        setWeatherData(data);
        setCurrentCity(data.name);
        setLat(data.coord.lat);
        setLon(data.coord.lon);
        addRecentCity(data.name);
        fetchForecast(data.coord.lat, data.coord.lon);
      } else {
        alert('City not found!');
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      alert('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      if (response.ok) {
        const hourly = data.list.slice(0, 8).map((item: any) => ({
          dt: item.dt,
          temp: item.main.temp,
          weather: item.weather,
          pop: item.pop,
        }));
        setHourlyForecast(hourly);

        const daily: DailyForecast[] = [];
        const days = new Map<string, any[]>();

        data.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000).toDateString();
          if (!days.has(date)) {
            days.set(date, []);
          }
          days.get(date)?.push(item);
        });

        let count = 0;
        days.forEach((items, date) => {
          if (count < 7) {
            const temps = items.map(item => item.main.temp);
            const maxTemp = Math.max(...temps);
            const minTemp = Math.min(...temps);
            const avgPop = items.reduce((sum, item) => sum + item.pop, 0) / items.length;

            daily.push({
              dt: items[0].dt,
              temp: {
                max: maxTemp,
                min: minTemp,
              },
              weather: items[0].weather,
              pop: avgPop,
            });
            count++;
          }
        });

        setDailyForecast(daily);
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCity.trim()) {
      fetchWeather(searchCity);
      setSearchCity('');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getWeatherIcon = (condition?: string, size: string = 'w-32 h-32') => {
    const weatherCondition = condition?.toLowerCase() || weatherData?.weather[0].main.toLowerCase();
    if (!weatherCondition) return <Sun className={`${size} text-yellow-400`} />;

    if (weatherCondition.includes('clear')) return <Sun className={`${size} text-yellow-400`} />;
    if (weatherCondition.includes('cloud')) return <Cloud className={`${size} text-gray-400`} />;
    if (weatherCondition.includes('rain')) return <CloudRain className={`${size} text-blue-400`} />;
    if (weatherCondition.includes('snow')) return <CloudSnow className={`${size} text-blue-200`} />;
    return <Sun className={`${size} text-yellow-400`} />;
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 transition-colors duration-300 ${
      isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-blue-50 to-blue-100'
    }`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`rounded-3xl p-4 md:p-6 mb-6 shadow-lg ${
          isDarkMode ? 'bg-slate-700/50' : 'bg-white/80'
        } backdrop-blur-sm`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl">
                <Sun className="w-6 md:w-8 h-6 md:h-8 text-white" />
              </div>
              <h1 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                LiveWeather
              </h1>
            </div>

            <form onSubmit={handleSearch} className="w-full lg:flex-1 lg:max-w-md">
              <div className="relative">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="Search City"
                  className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${
                    isDarkMode
                      ? 'bg-slate-600 border-slate-500 text-white placeholder-gray-400'
                      : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-500'
                  } focus:outline-none focus:border-blue-500`}
                />
              </div>
            </form>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
              <div className={`text-left sm:text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="text-xs md:text-sm font-medium">Current Date & Time</div>
                <div className="text-xs">{formatDateTime(currentDateTime)}</div>
              </div>
              <button
                onClick={useMyLocation}
                disabled={locationLoading}
                className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {locationLoading ? 'Getting Location...' : 'Use My Location'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Cities Sidebar */}
          <div className={`lg:col-span-3 rounded-3xl p-4 md:p-6 shadow-lg ${
            isDarkMode ? 'bg-slate-700/50' : 'bg-white/80'
          } backdrop-blur-sm`}>
            <h2 className={`text-xl md:text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Recent Cities
            </h2>
            <div className="space-y-3">
              {recentCities.length === 0 ? (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No recent searches yet
                </p>
              ) : (
                recentCities.map((city, index) => (
                  <button
                    key={index}
                    onClick={() => fetchWeather(city)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      city === currentCity
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isDarkMode
                        ? 'bg-slate-600 text-gray-200 hover:bg-slate-500'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${
                        city === currentCity ? 'text-white' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <span className="font-medium">{city}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Weather Display */}
          <div className={`lg:col-span-6 rounded-3xl p-6 md:p-8 shadow-lg ${
            isDarkMode ? 'bg-slate-700/50' : 'bg-white/80'
          } backdrop-blur-sm`}>
            {loading ? (
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
              </div>
            ) : weatherData ? (
              <div className="flex flex-col items-center">
                <div className="mb-8">{getWeatherIcon()}</div>
                <h2 className={`text-3xl md:text-5xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  {currentCity}
                </h2>
                <div className={`text-6xl md:text-8xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {Math.round(weatherData.main.temp)}°C
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center">
                  <div>
                    <div className={`text-lg md:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                      {weatherData.weather[0].main}
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Feels Like {Math.round(weatherData.main.feels_like)}°C
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Weather Details Sidebar */}
          <div className={`lg:col-span-3 rounded-3xl p-4 md:p-6 shadow-lg ${
            isDarkMode ? 'bg-slate-700/50' : 'bg-white/80'
          } backdrop-blur-sm space-y-4 md:space-y-6`}>
            {weatherData && (
              <>
                <div className="flex items-center gap-4">
                  <Droplets className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Humidity:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {weatherData.main.humidity}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Wind className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Wind:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {Math.round(weatherData.wind.speed * 3.6)} km/h
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Gauge className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Pressure:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {weatherData.main.pressure} hPa
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Eye className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Visibility:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {(weatherData.visibility / 1000).toFixed(1)} km
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Sunrise className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sunrise:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatTime(weatherData.sys.sunrise)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Sunset className={`w-6 md:w-8 h-6 md:h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <div>
                    <div className={`text-xs md:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sunset:</div>
                    <div className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatTime(weatherData.sys.sunset)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className={`lg:col-span-3 rounded-3xl p-4 md:p-6 shadow-lg ${
            isDarkMode ? 'bg-slate-700/50' : 'bg-white/80'
          } backdrop-blur-sm`}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-colors ${
                  isDarkMode ? 'bg-slate-600' : 'bg-blue-500'
                }`}
              >
                {isDarkMode ? (
                  <Moon className="w-6 h-6 text-white" />
                ) : (
                  <Sun className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            <button
              onClick={() => setShowMapModal(true)}
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Map View
            </button>
          </div>

          <div className={`lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6`}>
            <button
              onClick={() => setShowHourlyModal(true)}
              className={`rounded-3xl p-4 md:p-6 shadow-lg ${
                isDarkMode ? 'bg-slate-700/50 hover:bg-slate-600/50' : 'bg-white/80 hover:bg-white'
              } backdrop-blur-sm transition-all cursor-pointer`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-gray-100 p-3 rounded-xl">
                  <MapPin className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h3 className={`text-lg md:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Hourly Forecast
                  </h3>
                </div>
              </div>
            </button>

            <button
              onClick={() => setShowDailyModal(true)}
              className={`rounded-3xl p-4 md:p-6 shadow-lg ${
                isDarkMode ? 'bg-slate-700/50 hover:bg-slate-600/50' : 'bg-white/80 hover:bg-white'
              } backdrop-blur-sm transition-all cursor-pointer`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-gray-100 p-3 rounded-xl">
                  <span className="text-2xl font-bold text-gray-600">7</span>
                </div>
                <div>
                  <h3 className={`text-lg md:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    7 Day Forecast
                  </h3>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Hourly Forecast Modal */}
        {showHourlyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-3xl p-6 md:p-8 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${
              isDarkMode ? 'bg-slate-800' : 'bg-white'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Hourly Forecast
                </h2>
                <button
                  onClick={() => setShowHourlyModal(false)}
                  className={`p-2 rounded-xl ${
                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {hourlyForecast.map((hour, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl p-4 ${
                      isDarkMode ? 'bg-slate-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {new Date(hour.dt * 1000).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </div>
                    <div className="flex justify-center my-3">
                      {getWeatherIcon(hour.weather[0].main, 'w-12 h-12')}
                    </div>
                    <div className={`text-2xl font-bold text-center ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {Math.round(hour.temp)}°C
                    </div>
                    <div className={`text-xs text-center mt-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {hour.weather[0].description}
                    </div>
                    <div className={`text-xs text-center mt-1 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {Math.round(hour.pop * 100)}% rain
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7 Day Forecast Modal */}
        {showDailyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-3xl p-6 md:p-8 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${
              isDarkMode ? 'bg-slate-800' : 'bg-white'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  7 Day Forecast
                </h2>
                <button
                  onClick={() => setShowDailyModal(false)}
                  className={`p-2 rounded-xl ${
                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                </button>
              </div>

              <div className="space-y-4">
                {dailyForecast.map((day, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isDarkMode ? 'bg-slate-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`text-base md:text-lg font-semibold w-24 md:w-32 ${
                        isDarkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {index === 0
                          ? 'Today'
                          : new Date(day.dt * 1000).toLocaleDateString('en-US', {
                              weekday: 'long',
                            })}
                      </div>
                      <div className={`text-xs md:text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {new Date(day.dt * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-2">
                        {getWeatherIcon(day.weather[0].main, 'w-6 h-6 md:w-8 md:h-8')}
                        <span className={`text-xs md:text-sm capitalize ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {day.weather[0].description}
                        </span>
                      </div>

                      <div className={`text-xs md:text-sm ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        {Math.round(day.pop * 100)}%
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-base md:text-lg font-semibold ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {Math.round(day.temp.max)}°
                        </span>
                        <span className={`text-base md:text-lg ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {Math.round(day.temp.min)}°
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map View Modal */}
        {showMapModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-3xl p-6 md:p-8 shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden ${
              isDarkMode ? 'bg-slate-800' : 'bg-white'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Map View
                  </h2>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {currentCity}
                  </p>
                </div>
                <button
                  onClick={() => setShowMapModal(false)}
                  className={`p-2 rounded-xl ${
                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                </button>
              </div>

              <div className="mb-4">
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <p className="mb-2 font-semibold">Click anywhere on the map to get weather for that location.</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Use two fingers to rotate and tilt the map (on mobile)</li>
                    <li>Hold Shift + drag to rotate (on desktop)</li>
                    <li>Use the rotate control in the bottom right corner</li>
                    <li>Switch between map types using the controls</li>
                  </ul>
                </div>
              </div>
              <div
                id="weather-map"
                className="w-full h-[400px] md:h-[500px] rounded-2xl border-4 border-blue-500/20"
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
