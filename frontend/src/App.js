import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./App.css";

// Environment variables
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
console.log("Backend URL:", BACKEND_URL);
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext(null);

const useAuth = () => {
  return React.useContext(AuthContext);
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (token) {
      // Configure axios to use the token
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      
      // Get user profile
      axios.get(`${API}/auth/me`)
        .then(response => {
          setUser(response.data);
        })
        .catch(error => {
          console.error("Auth error:", error);
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/token`, 
        new URLSearchParams({
          'username': email,
          'password': password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const { access_token, user_id, name, email: userEmail } = response.data;
      
      localStorage.setItem("token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      setUser({ id: user_id, name, email: userEmail });
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const register = async (name, email, password, timezone) => {
    try {
      await axios.post(`${API}/auth/register`, {
        name,
        email,
        password,
        timezone
      });
      
      return true;
    } catch (error) {
      console.error("Register error:", error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!auth.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Components
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    
    const success = await auth.login(email, password);
    
    if (success) {
      navigate(from, { replace: true });
    } else {
      setError("Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign in
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }
    
    const result = await auth.register(name, email, password, timezone);
    
    if (result) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } else {
      setError("Registration failed. Email may already be in use.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Create account</h2>
            <p className="text-gray-600 mt-2">Sign up for virtual coworking</p>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              Registration successful! Redirecting to login...
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Automatically detected based on your browser settings</p>
            </div>
            
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign up
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const auth = useAuth();
  
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await axios.get(`${API}/sessions`);
        setSessions(response.data);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        setError("Failed to load your sessions.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessions();
  }, []);
  
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };
  
  const getSessionStatus = (session) => {
    const now = new Date();
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);
    
    if (now < startTime) {
      return "Upcoming";
    } else if (now >= startTime && now <= endTime) {
      return "In Progress";
    } else {
      return "Completed";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your Coworking Dashboard</h1>
        <div className="flex space-x-4">
          <button 
            onClick={() => navigate("/create-session")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Session
          </button>
          <button 
            onClick={() => navigate("/find-session")}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Find a Partner
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your sessions...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
          <p className="text-gray-600 mb-4">
            Create a session or find a partner to get started with virtual coworking.
          </p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => navigate("/create-session")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Create Session
            </button>
            <button 
              onClick={() => navigate("/find-session")}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
            >
              Find a Partner
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Sessions</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium truncate">{session.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getSessionStatus(session) === "Upcoming" 
                        ? "bg-blue-100 text-blue-800" 
                        : getSessionStatus(session) === "In Progress" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {getSessionStatus(session)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Start:</span> {formatDate(session.start_time)}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">End:</span> {formatDate(session.end_time)}
                  </p>
                  
                  <p className="text-sm text-gray-600 mb-4">
                    <span className="font-medium">Status:</span>{" "}
                    {session.partner_id ? "Matched with a partner" : "Waiting for partner"}
                  </p>
                  
                  <div>
                    <button
                      onClick={() => navigate(`/session/${session.id}`)}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {getSessionStatus(session) === "In Progress" 
                        ? "Join Session" 
                        : getSessionStatus(session) === "Upcoming" 
                        ? "View Details" 
                        : "View Recap"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateSession = () => {
  const [title, setTitle] = useState("Coworking Session");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  useEffect(() => {
    // Set default date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    setDate(formattedDate);
    
    // Set default time to next hour
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    
    const hours = nextHour.getHours().toString().padStart(2, '0');
    const minutes = nextHour.getMinutes().toString().padStart(2, '0');
    setStartTime(`${hours}:${minutes}`);
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // Combine date and time for start datetime
      const startDateTime = new Date(`${date}T${startTime}`);
      
      // Calculate end time based on duration
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + parseInt(duration));
      
      const response = await axios.post(`${API}/sessions`, {
        title,
        description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString()
      });
      
      navigate(`/session/${response.data.id}`);
    } catch (error) {
      console.error("Error creating session:", error);
      setError("Failed to create session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create a Coworking Session</h1>
        <p className="text-gray-600">Schedule a time to work alongside a partner for accountability</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Session Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="description"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="What do you plan to work on? Any specifics to share with your partner?"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration (minutes)
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="25">25 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes (1 hour)</option>
            <option value="90">90 minutes (1.5 hours)</option>
            <option value="120">120 minutes (2 hours)</option>
          </select>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {loading ? "Creating..." : "Create Session"}
          </button>
        </div>
      </form>
    </div>
  );
};

const FindSession = () => {
  const [availableSessions, setAvailableSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningSession, setJoiningSession] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchAvailableSessions = async () => {
      try {
        const response = await axios.get(`${API}/sessions/available`);
        setAvailableSessions(response.data);
      } catch (error) {
        console.error("Error fetching available sessions:", error);
        setError("Failed to load available sessions.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableSessions();
  }, []);
  
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };
  
  const calculateDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes} minutes`;
    }
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
  };
  
  const joinSession = async (sessionId) => {
    setJoiningSession(sessionId);
    try {
      const response = await axios.post(`${API}/sessions/${sessionId}/join`);
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error("Error joining session:", error);
      setError("Failed to join session. Please try again.");
      setJoiningSession(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Find a Coworking Partner</h1>
        <p className="text-gray-600">Join an existing session or create your own</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-gray-700">Can't find a suitable session?</p>
        </div>
        <button 
          onClick={() => navigate("/create-session")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Create Your Own Session
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading available sessions...</p>
        </div>
      ) : availableSessions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No available sessions found</h3>
          <p className="text-gray-600 mb-4">
            Create your own session and wait for a partner to join.
          </p>
          <button 
            onClick={() => navigate("/create-session")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {availableSessions.map((session) => (
            <div 
              key={session.id} 
              className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-medium truncate">{session.title}</h3>
              </div>
              
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Start:</span> {formatDate(session.start_time)}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Duration:</span> {calculateDuration(session.start_time, session.end_time)}
                </p>
                
                {session.description && (
                  <p className="text-sm text-gray-600 mb-4 border-t pt-2">
                    {session.description}
                  </p>
                )}
                
                <div>
                  <button
                    onClick={() => joinSession(session.id)}
                    disabled={joiningSession === session.id}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                  >
                    {joiningSession === session.id ? "Joining..." : "Join Session"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VideoRoom = ({ roomUrl }) => {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load the Daily.co script dynamically
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@daily-co/daily-js';
    script.async = true;
    
    script.onload = () => {
      setLoading(false);
    };
    
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  useEffect(() => {
    if (!loading && roomUrl) {
      // Create the iframe
      const callFrame = window.DailyIframe.createFrame({
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          backgroundColor: 'black',
        },
        showLeaveButton: true,
      });
      
      callFrame.join({ url: roomUrl });
      
      return () => {
        callFrame.destroy();
      };
    }
  }, [loading, roomUrl]);
  
  if (loading || !roomUrl) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        <p className="ml-3 text-gray-700">Setting up video call...</p>
      </div>
    );
  }
  
  return (
    <div className="h-full w-full">
      {/* Daily.co will render the video call in this container */}
    </div>
  );
};

const FeedbackForm = ({ sessionId, onComplete }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      await axios.post(`${API}/sessions/${sessionId}/feedback`, {
        rating,
        comment
      });
      
      onComplete();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Session Feedback</h2>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How was your coworking session?
          </label>
          <div className="flex space-x-4 items-center">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  rating >= value 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-1 text-sm text-gray-500 flex justify-between">
            <span>Not helpful</span>
            <span>Very helpful</span>
          </div>
        </div>
        
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
            Additional comments (optional)
          </label>
          <textarea
            id="comment"
            rows="3"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="How was the session? Any suggestions for improvement?"
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onComplete}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
};

const SessionDetails = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const sessionId = location.pathname.split('/').pop();
  
  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        const response = await axios.get(`${API}/sessions/${sessionId}`);
        setSession(response.data);
      } catch (error) {
        console.error("Error fetching session details:", error);
        setError("Failed to load session details.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionDetails();
  }, [sessionId]);
  
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };
  
  const getSessionStatus = () => {
    if (!session) return "";
    
    const now = new Date();
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);
    
    if (now < startTime) {
      return "upcoming";
    } else if (now >= startTime && now <= endTime) {
      return "active";
    } else {
      return "completed";
    }
  };
  
  const handleFeedbackComplete = () => {
    setShowFeedback(false);
    navigate("/dashboard");
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        <p className="ml-3 text-gray-700">Loading session details...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded mb-4">
          Session not found.
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  if (showFeedback) {
    return (
      <div className="container mx-auto px-4 py-8">
        <FeedbackForm 
          sessionId={session.id} 
          onComplete={handleFeedbackComplete} 
        />
      </div>
    );
  }
  
  const isHost = session.host_id === user.id;
  const hasPartner = session.partner_id !== null;
  const status = getSessionStatus();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{session.title}</h1>
          <p className="text-gray-600">
            {status === "upcoming" 
              ? "Scheduled Session" 
              : status === "active" 
              ? "In Progress" 
              : "Completed Session"}
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Session Details</h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium">{formatDate(session.start_time)}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">End Time</p>
                <p className="font-medium">{formatDate(session.end_time)}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`font-medium ${
                  status === "upcoming" 
                    ? "text-blue-600" 
                    : status === "active" 
                    ? "text-green-600" 
                    : "text-gray-600"
                }`}>
                  {status === "upcoming" 
                    ? "Upcoming" 
                    : status === "active" 
                    ? "In Progress" 
                    : "Completed"}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Your Role</p>
                <p className="font-medium">{isHost ? "Host" : "Partner"}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Partner Status</p>
                <p className="font-medium">
                  {hasPartner 
                    ? "Matched with partner" 
                    : "Waiting for partner to join"}
                </p>
              </div>
            </div>
            
            {session.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p>{session.description}</p>
              </div>
            )}
          </div>
          
          {status === "completed" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-2">Session Completed</h2>
              <p className="text-gray-600 mb-4">Thank you for participating in this coworking session.</p>
              
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Provide Feedback
              </button>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2">
          {status === "active" && session.room_url ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ height: "600px" }}>
              <VideoRoom roomUrl={session.room_url} />
            </div>
          ) : status === "upcoming" ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h2 className="text-xl font-medium mb-2">Session Not Started Yet</h2>
              <p className="text-gray-600 mb-6">
                This session will be available to join at the scheduled start time.
              </p>
              <div className="flex justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b" 
                  alt="Virtual coworking illustration" 
                  className="w-full max-w-md rounded-lg shadow-md" 
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h2 className="text-xl font-medium mb-2">Session Completed</h2>
              <p className="text-gray-600 mb-6">
                This coworking session has ended. You can provide feedback or schedule another session.
              </p>
              <div className="flex justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1616587226157-48e49175ee20" 
                  alt="Completed session illustration" 
                  className="w-full max-w-md rounded-lg shadow-md" 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  
  return (
    <div className="bg-white">
      <div className="relative overflow-hidden">
        {/* Hero section */}
        <div className="relative pt-6 pb-16 sm:pb-24">
          <div className="mt-16 mx-auto max-w-7xl px-4 sm:mt-24 sm:px-6">
            <div className="text-center">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block">Virtual Coworking</span>
                <span className="block text-indigo-600">for Productivity & Focus</span>
              </h1>
              <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Book sessions to work alongside another person over video,
                creating accountability and structure for getting tasks done.
              </p>
              <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
                <div className="rounded-md shadow">
                  <button
                    onClick={() => navigate("/register")}
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
                  >
                    Get started
                  </button>
                </div>
                <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <button
                    onClick={() => navigate("/login")}
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
                  >
                    Log in
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex flex-col" aria-hidden="true">
            <div className="flex-1" />
            <div className="flex-1 w-full bg-gray-800" />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <img
              className="relative rounded-lg shadow-lg"
              src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b"
              alt="Video call screenshot"
            />
          </div>
        </div>
      </div>
      <div className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
          <h2 className="text-center text-gray-100 text-sm font-semibold uppercase tracking-wide">
            How it works
          </h2>
          <div className="mt-8 grid gap-8 grid-cols-1 md:grid-cols-3">
            <div className="bg-gray-700 rounded-lg px-6 py-8">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">1. Book a session</h3>
              <p className="mt-2 text-gray-300">
                Schedule a time that works for you - from 25 minutes to 2 hours.
              </p>
            </div>
            
            <div className="bg-gray-700 rounded-lg px-6 py-8">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">2. Get matched</h3>
              <p className="mt-2 text-gray-300">
                We'll automatically pair you with a partner for your session.
              </p>
            </div>
            
            <div className="bg-gray-700 rounded-lg px-6 py-8">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">3. Work together</h3>
              <p className="mt-2 text-gray-300">
                Join the video session, share your goals, and work in focused silence.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-base font-semibold text-indigo-600 tracking-wide uppercase">Testimonials</h2>
            <p className="mt-1 text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
              People love coworking virtually
            </p>
          </div>
          <div className="mt-12 max-w-lg mx-auto grid gap-8 lg:grid-cols-3 lg:max-w-none">
            <div className="flex flex-col rounded-lg shadow-lg overflow-hidden">
              <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                <div className="flex-1">
                  <p className="text-xl font-semibold text-gray-900">"Doubled my productivity"</p>
                  <p className="mt-3 text-base text-gray-600">
                    Having someone there, even virtually, keeps me accountable and focused on my tasks.
                  </p>
                </div>
                <div className="mt-6 flex items-center">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      Sarah K.
                    </p>
                    <p className="text-sm text-gray-500">
                      Freelance Designer
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col rounded-lg shadow-lg overflow-hidden">
              <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                <div className="flex-1">
                  <p className="text-xl font-semibold text-gray-900">"Perfect for remote work"</p>
                  <p className="mt-3 text-base text-gray-600">
                    As a remote worker, this gives me the structure I was missing from an office environment.
                  </p>
                </div>
                <div className="mt-6 flex items-center">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      Marcus T.
                    </p>
                    <p className="text-sm text-gray-500">
                      Software Engineer
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col rounded-lg shadow-lg overflow-hidden">
              <div className="flex-1 bg-white p-6 flex flex-col justify-between">
                <div className="flex-1">
                  <p className="text-xl font-semibold text-gray-900">"Helped me finish my thesis"</p>
                  <p className="mt-3 text-base text-gray-600">
                    Regular sessions with accountability partners kept me on track with my research deadlines.
                  </p>
                </div>
                <div className="mt-6 flex items-center">
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      Elena J.
                    </p>
                    <p className="text-sm text-gray-500">
                      PhD Student
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-indigo-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to be more productive?</span>
            <span className="block">Start coworking today.</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-indigo-200">
            Join our community of focused professionals and achieve your goals together.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 sm:w-auto"
          >
            Sign up for free
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create-session" 
            element={
              <ProtectedRoute>
                <CreateSession />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/find-session" 
            element={
              <ProtectedRoute>
                <FindSession />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/session/:id" 
            element={
              <ProtectedRoute>
                <SessionDetails />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
