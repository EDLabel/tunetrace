// App.tsx
// Complete working version with all hooks properly ordered
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    TextInput,
    Alert,
    ScrollView,
    Modal,
    Button,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Linking } from 'react-native';
import * as Calendar from 'expo-calendar';

// ⚠️ REPLACE THIS WITH YOUR ACTUAL IP ADDRESS ⚠️
const YOUR_COMPUTER_IP = '192.168.16.25'; // ← Change this!
const API_BASE = `http://${YOUR_COMPUTER_IP}:3000`;
const WS_URL = `ws://${YOUR_COMPUTER_IP}:3000`;

// Types
interface User {
    id: string;
    email: string;
    displayName: string;
}

interface Concert {
    id: string;
    title: string;
    artists: Array<{
        name: string;
        id: string;
        image: string;
    }>;
    venue: {
        name: string;
        location: {
            address: string;
            city: string;
            country: string;
            coordinates: {
                latitude: number;
                longitude: number;
            };
        };
    };
    dateTime: string;
    ticketInfo: {
        url: string;
        priceRange: {
            min: number;
            max: number;
            currency: string;
        };
        onSale: boolean;
    };
    attendees: number;
    genre: string;
}

interface ApiResponse {
    concerts: Concert[];
    total: number;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    pageSize: number;
    city: string;
    source: string;
    message?: string;
    isLoadMore?: boolean;
}

interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    data: any;
    isRead: boolean;
    createdAt: string;
}

interface PriceAlert {
    id: string;
    concertId: string;
    concertTitle: string;
    artistName: string;
    targetPrice: number;
    isActive: boolean;
    createdAt: string;
}

// Auth Context
interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, displayName: string) => Promise<boolean>;
    logout: () => void;
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    loadNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        loadStoredAuth();
    }, []);

    useEffect(() => {
        if (token && user) {
            setupWebSocket();
            loadNotifications();
            loadUnreadCount();
        } else {
            if (ws.current) {
                ws.current.close();
            }
        }

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [token, user]);

    const setupWebSocket = () => {
        if (!token) return;

        try {
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log('🔌 WebSocket connected');
                ws.current?.send(JSON.stringify({
                    type: 'AUTHENTICATE',
                    token: token
                }));
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 WebSocket message:', data);

                    if (data.type === 'NEW_NOTIFICATION') {
                        setNotifications(prev => [data.notification, ...prev]);
                        setUnreadCount(prev => prev + 1);

                        if (data.notification.priority === 'high') {
                            Alert.alert(
                                data.notification.title,
                                data.notification.message,
                                [{ text: 'OK' }]
                            );
                        }
                    } else if (data.type === 'AUTHENTICATED') {
                        console.log('✅ WebSocket authenticated');
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.current.onclose = () => {
                console.log('❌ WebSocket disconnected');
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Failed to setup WebSocket:', error);
        }
    };

    const loadStoredAuth = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('userToken');
            const storedUser = await AsyncStorage.getItem('userData');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to load auth data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadNotifications = async () => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    const loadUnreadCount = async () => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUnreadCount(data.count);
            }
        } catch (error) {
            console.error('Failed to load unread count:', error);
        }
    };

    const markAsRead = async (notificationId: string) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(notif =>
                        notif._id === notificationId
                            ? { ...notif, isRead: true }
                            : notif
                    )
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setNotifications(prev =>
                    prev.map(notif => ({ ...notif, isRead: true }))
                );
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const notification = notifications.find(n => n._id === notificationId);
                setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
                if (notification && !notification.isRead) {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data: AuthResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            await AsyncStorage.setItem('userToken', data.token);
            await AsyncStorage.setItem('userData', JSON.stringify(data.user));

            setToken(data.token);
            setUser(data.user);

            return true;
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
            return false;
        }
    };

    const register = async (email: string, password: string, displayName: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, displayName }),
            });

            const data: AuthResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            await AsyncStorage.setItem('userToken', data.token);
            await AsyncStorage.setItem('userData', JSON.stringify(data.user));

            setToken(data.token);
            setUser(data.user);

            return true;
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
            return false;
        }
    };

    const logout = async () => {
        try {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            setToken(null);
            setUser(null);
            setNotifications([]);
            setUnreadCount(0);

            if (ws.current) {
                ws.current.close();
            }

            Alert.alert('Logged Out', 'You have been successfully logged out.');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            login,
            register,
            logout,
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            loadNotifications
        }}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const useApi = () => {
    const { token } = useAuth();

    const apiFetch = async (url: string, options: RequestInit = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            throw new Error('Authentication required');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    };

    return { apiFetch };
};

// Main App Component
type Screen = 'home' | 'concertDetail' | 'artistSearch' | 'trackedArtists' | 'favorites' | 'login' | 'register' | 'profile' | 'notifications' | 'priceAlerts';

const AppContent: React.FC = () => {
    const {
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        loadNotifications
    } = useAuth();
    const { apiFetch } = useApi();

    const [currentScreen, setCurrentScreen] = useState<Screen>('home');
    const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
    const [searchCity, setSearchCity] = useState('New York');
    const [searchGenre, setSearchGenre] = useState('');
    const [concerts, setConcerts] = useState<Concert[]>([]);
    const [backendStatus, setBackendStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
    const [trackedArtists, setTrackedArtists] = useState<any[]>([]);
    const [favoriteConcerts, setFavoriteConcerts] = useState<any[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [artistSearchResults, setArtistSearchResults] = useState<any[]>([]);
    const [artistSearchQuery, setArtistSearchQuery] = useState('');
    const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
    const [priceAlertInput, setPriceAlertInput] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [sortBy, setSortBy] = useState('name');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalConcerts, setTotalConcerts] = useState(0);
    const [isLoadingConcerts, setIsLoadingConcerts] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Auth form states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerDisplayName, setRegisterDisplayName] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // Redirect to login if not authenticated for protected features
    useEffect(() => {
        if (!user && !isLoading) {
            if (currentScreen === 'trackedArtists' || currentScreen === 'favorites' || currentScreen === 'notifications' || currentScreen === 'priceAlerts') {
                setCurrentScreen('login');
            }
        }
    }, [user, isLoading, currentScreen]);

    // Load initial data
    useEffect(() => {
        testBackendConnection();
        if (user) {
            loadTrackedArtists();
            loadFavoriteConcerts();
            loadNotifications();
            loadPriceAlerts();
        }
    }, [user]);

    // Reset price alert input when concert changes
    useEffect(() => {
        setPriceAlertInput('');
    }, [selectedConcert]);

    const testBackendConnection = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/health`);
            const data = await response.json();
            setBackendStatus('connected');
        } catch (error) {
            setBackendStatus('failed');
        }
    };

    // Price Alert Functions
    const savePriceAlertToBackend = async (alert: PriceAlert) => {
        try {
            const allAlerts = [...priceAlerts, alert];
            await AsyncStorage.setItem('priceAlerts', JSON.stringify(allAlerts));
            console.log('✅ Price alert saved locally');
        } catch (error) {
            console.error('Failed to save price alert:', error);
        }
    };

    const loadPriceAlerts = async () => {
        try {
            const savedAlerts = await AsyncStorage.getItem('priceAlerts');
            if (savedAlerts) {
                setPriceAlerts(JSON.parse(savedAlerts));
            }
        } catch (error) {
            console.error('Failed to load price alerts:', error);
        }
    };

    const setPriceAlert = async (concert: Concert, targetPrice: number) => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to set price alerts.');
            setCurrentScreen('login');
            return;
        }

        const newAlert: PriceAlert = {
            id: `alert-${concert.id}-${Date.now()}`,
            concertId: concert.id,
            concertTitle: concert.title,
            artistName: concert.artists[0]?.name,
            targetPrice,
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        setPriceAlerts(prev => [...prev, newAlert]);
        await savePriceAlertToBackend(newAlert);

        Alert.alert(
            'Price Alert Set!',
            `We'll notify you when tickets for ${concert.title} drop below $${targetPrice}`
        );
    };

    // Offline Support Functions
    const saveConcertsOffline = async (concerts: Concert[]) => {
        try {
            await AsyncStorage.setItem('offline_concerts', JSON.stringify(concerts));
            await AsyncStorage.setItem('offline_last_updated', new Date().toISOString());
            console.log('✅ Concerts saved offline');
        } catch (error) {
            console.error('Failed to save offline:', error);
        }
    };

    const loadOfflineConcerts = async () => {
        try {
            const saved = await AsyncStorage.getItem('offline_concerts');
            const lastUpdated = await AsyncStorage.getItem('offline_last_updated');

            if (saved) {
                const concerts = JSON.parse(saved);
                setConcerts(concerts);
                console.log(`📂 Loaded ${concerts.length} concerts from offline storage`);

                if (lastUpdated) {
                    const daysSinceUpdate = Math.floor(
                        (new Date().getTime() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    if (daysSinceUpdate > 1) {
                        Alert.alert(
                            'Offline Data',
                            `Concerts loaded from offline storage (last updated ${daysSinceUpdate} days ago)`
                        );
                    }
                }
                return true;
            }
        } catch (error) {
            console.error('Failed to load offline:', error);
        }
        return false;
    };

    const fetchConcertsFromBackend = async (page: number = 0, loadMore: boolean = false) => {
        if (loadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoadingConcerts(true);
            setCurrentPage(0);
        }

        try {
            let url = `/api/concerts?city=${searchCity}&page=${page}&loadMore=${loadMore}`;
            if (searchGenre) {
                url += `&genre=${searchGenre}`;
            }

            const data: ApiResponse = await apiFetch(url);

            if (data.concerts && data.concerts.length > 0) {
                if (loadMore) {
                    setConcerts(prev => [...prev, ...data.concerts]);
                } else {
                    setConcerts(data.concerts);
                }

                setCurrentPage(data.page);
                setHasNextPage(data.hasNextPage);
                setTotalConcerts(data.total);

                if (!loadMore) {
                    if (data.source === 'Ticketmaster API') {
                        Alert.alert('Success', `Found ${data.total} concerts in ${searchCity}!`);
                    } else if (data.message) {
                        Alert.alert('Info', data.message);
                    }
                }
                await saveConcertsOffline(data.concerts);
            } else if (!loadMore) {
                Alert.alert('No Concerts', `No concerts found in ${searchCity}. Try another city!`);
                setConcerts([]);
                setHasNextPage(false);
                setTotalConcerts(0);
            }
        } catch (error: any) {
            console.error('Error fetching concerts:', error);
            if (!loadMore) {
                Alert.alert('Error', 'Could not fetch concerts from backend.');
            }

            const offlineLoaded = await loadOfflineConcerts();
            if (offlineLoaded) {
                Alert.alert('Offline Mode', 'Showing cached concerts. Check your internet connection.');
            } else if (!loadMore) {
                Alert.alert('Error', 'Could not fetch concerts and no offline data available.');
            }
        } finally {
            setIsLoadingConcerts(false);
            setIsLoadingMore(false);
        }
    };

    const loadMoreConcerts = () => {
        if (hasNextPage && !isLoadingMore) {
            const nextPage = currentPage + 1;
            fetchConcertsFromBackend(nextPage, true);
        }
    };

    const handleSearch = () => {
        if (searchCity.trim()) {
            fetchConcertsFromBackend(0, false);
        }
    };

    const trackArtist = async (artist: any) => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to track artists.');
            setCurrentScreen('login');
            return;
        }

        try {
            await apiFetch('/api/artists/track', {
                method: 'POST',
                body: JSON.stringify({
                    artistId: artist.id,
                    artistName: artist.name,
                    artistImage: artist.image,
                    genre: artist.genre
                }),
            });

            Alert.alert('Success', `Now tracking ${artist.name}! You'll get notified when they announce new concerts.`);
            loadTrackedArtists();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to track artist');
        }
    };

    const loadTrackedArtists = async () => {
        if (!user) return;

        try {
            const data = await apiFetch('/api/artists/tracked');
            setTrackedArtists(data.artists);
        } catch (error) {
            console.log('Failed to load tracked artists');
        }
    };

    const favoriteConcert = async (concert: Concert) => {
        if (!user) {
            Alert.alert('Login Required', 'Please log in to save favorite concerts.');
            setCurrentScreen('login');
            return;
        }

        try {
            await apiFetch('/api/concerts/favorite', {
                method: 'POST',
                body: JSON.stringify({
                    concertId: concert.id,
                    concertData: concert
                }),
            });

            Alert.alert('Success', 'Concert added to favorites!');
            loadFavoriteConcerts();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to favorite concert');
        }
    };

    const loadFavoriteConcerts = async () => {
        if (!user) return;

        try {
            const data = await apiFetch('/api/concerts/favorites');
            setFavoriteConcerts(data.favorites);
        } catch (error) {
            console.log('Failed to load favorite concerts');
        }
    };

    const searchArtists = async (query: string) => {
        try {
            const data = await apiFetch(`/api/artists/search?query=${encodeURIComponent(query)}`);
            setArtistSearchResults(data.artists || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to search artists');
            setArtistSearchResults([]);
        }
    };

    const handleLogin = async () => {
        if (!loginEmail || !loginPassword) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoggingIn(true);
        const success = await login(loginEmail, loginPassword);
        setIsLoggingIn(false);

        if (success) {
            setLoginEmail('');
            setLoginPassword('');
            setCurrentScreen('home');
        }
    };

    const handleRegister = async () => {
        if (!registerEmail || !registerPassword || !registerDisplayName) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (registerPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setIsRegistering(true);
        const success = await register(registerEmail, registerPassword, registerDisplayName);
        setIsRegistering(false);

        if (success) {
            setRegisterEmail('');
            setRegisterPassword('');
            setRegisterDisplayName('');
            setCurrentScreen('home');
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const formatNotificationDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusColor = () => {
        switch (backendStatus) {
            case 'connected': return '#4CAF50';
            case 'failed': return '#F44336';
            default: return '#FF9800';
        }
    };

    const getStatusText = () => {
        switch (backendStatus) {
            case 'connected': return 'Backend: Connected ✓';
            case 'failed': return 'Backend: Disconnected ✗';
            default: return 'Backend: Unknown';
        }
    };

    const renderFooter = () => {
        if (!hasNextPage && concerts.length === 0) {
            return (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>No concerts found</Text>
                </View>
            );
        }

        if (!hasNextPage && concerts.length > 0) {
            return (
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        All {concerts.length} concerts loaded
                    </Text>
                </View>
            );
        }

        if (isLoadingMore) {
            return (
                <View style={styles.footer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.footerText}>Loading more concerts...</Text>
                </View>
            );
        }

        return (
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreConcerts}>
                <Text style={styles.loadMoreButtonText}>Load More Concerts</Text>
                <Text style={styles.loadMoreSubtext}>Page {currentPage + 1}</Text>
            </TouchableOpacity>
        );
    };

    // Calendar Integration
    const addToCalendar = async (concert: Concert) => {
        try {
            const eventId = await Calendar.createEventAsync(Calendar.DEFAULT, {
                title: concert.title,
                startDate: new Date(concert.dateTime),
                endDate: new Date(new Date(concert.dateTime).getTime() + 2 * 60 * 60 * 1000), // 2 hours later
                location: `${concert.venue.name}, ${concert.venue.location.city}`,
                notes: `Concert via TuneTrace\nArtists: ${concert.artists.map(a => a.name).join(', ')}\nVenue: ${concert.venue.name}`,
            });

            Alert.alert('Added to Calendar', 'Concert has been added to your device calendar!');
            return eventId;
        } catch (error) {
            console.error('Calendar error:', error);
            Alert.alert('Error', 'Could not add to calendar. Make sure you have calendar permissions enabled.');
            return null;
        }
    };

    // ================== SCREEN RENDERERS ==================

    // Home Screen
    const renderHomeScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>🎵 TuneTrace</Text>
                    <View style={styles.headerButtons}>
                        {user ? (
                            <>
                                <TouchableOpacity
                                    style={styles.notificationButton}
                                    onPress={() => setCurrentScreen('notifications')}
                                >
                                    <Text style={styles.notificationIcon}>🔔</Text>
                                    {unreadCount > 0 && (
                                        <View style={styles.notificationBadge}>
                                            <Text style={styles.notificationBadgeText}>
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.profileButton}
                                    onPress={() => setCurrentScreen('profile')}
                                >
                                    <Text style={styles.profileButtonText}>
                                        {user.displayName?.charAt(0).toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={styles.authHeaderButton}
                                onPress={() => setCurrentScreen('login')}
                            >
                                <Text style={styles.authHeaderButtonText}>Login</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Status and Navigation */}
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>

                <View style={styles.navButtons}>
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => user ? setCurrentScreen('trackedArtists') : setCurrentScreen('login')}
                    >
                        <Text style={styles.navButtonText}>Tracked Artists ({trackedArtists.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => user ? setCurrentScreen('favorites') : setCurrentScreen('login')}
                    >
                        <Text style={styles.navButtonText}>Favorites ({favoriteConcerts.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => setCurrentScreen('artistSearch')}
                    >
                        <Text style={styles.navButtonText}>Search Artists</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => user ? setCurrentScreen('priceAlerts') : setCurrentScreen('login')}
                    >
                        <Text style={styles.navButtonText}>Price Alerts ({priceAlerts.length})</Text>
                    </TouchableOpacity>
                </View>

                {/* Search and Filters */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by city..."
                        value={searchCity}
                        onChangeText={setSearchCity}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                        <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
                    <Text style={styles.filterButtonText}>Filters</Text>
                </TouchableOpacity>

                {/* Results Info */}
                {concerts.length > 0 && (
                    <View style={styles.resultsInfo}>
                        <Text style={styles.resultsText}>
                            Showing {concerts.length} of {totalConcerts} concerts in {searchCity}
                        </Text>
                    </View>
                )}

                {/* Concerts List */}
                {isLoadingConcerts ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Loading concerts...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={concerts}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.concertCard}
                                onPress={() => {
                                    setSelectedConcert(item);
                                    setCurrentScreen('concertDetail');
                                }}
                            >
                                <Image source={{ uri: item.artists[0]?.image }} style={styles.artistImage} />
                                <View style={styles.concertInfo}>
                                    <Text style={styles.artistName} numberOfLines={1}>
                                        {item.artists.map((artist: any) => artist.name).join(', ')}
                                    </Text>
                                    <Text style={styles.venue} numberOfLines={1}>
                                        {item.venue.name} • {item.venue.location.city}
                                    </Text>
                                    <Text style={styles.date}>
                                        {formatDate(item.dateTime)}
                                    </Text>
                                    <Text style={styles.genre}>{item.genre}</Text>
                                    <Text style={styles.price}>
                                        ${item.ticketInfo.priceRange.min} - ${item.ticketInfo.priceRange.max}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.favoriteButton}
                                    onPress={() => favoriteConcert(item)}
                                >
                                    <Text style={styles.favoriteButtonText}>♥</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item.id}
                        ListFooterComponent={renderFooter}
                        onEndReached={loadMoreConcerts}
                        onEndReachedThreshold={0.5}
                    />
                )}

                {/* Filters Modal */}
                <Modal visible={showFilters} animationType="slide" transparent={true}>
                    <SafeAreaView style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>Filters</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Genre (Rock, Jazz, EDM, Hip Hop...)"
                                value={searchGenre}
                                onChangeText={setSearchGenre}
                            />
                            <View style={styles.modalButtons}>
                                <Button title="Apply Filters" onPress={() => {
                                    setShowFilters(false);
                                    handleSearch();
                                }} />
                                <Button title="Cancel" onPress={() => setShowFilters(false)} color="#999" />
                            </View>
                        </View>
                    </SafeAreaView>
                </Modal>
            </View>
        </SafeAreaView>
    );

    // Concert Detail Screen
    const renderConcertDetailScreen = () => {
        if (!selectedConcert) {
            return (
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.container}>
                        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                            <Text style={styles.backButtonText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>No Concert Selected</Text>
                    </View>
                </SafeAreaView>
            );
        }

        const currentConcertAlerts = priceAlerts.filter(alert => alert.concertId === selectedConcert.id);

        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView style={styles.container}>
                    {/* Back button */}
                    <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>

                    {/* Concert Image/Artist Image */}
                    <View style={styles.concertHeader}>
                        <Image
                            source={{ uri: selectedConcert.artists[0]?.image || 'https://via.placeholder.com/150' }}
                            style={styles.concertImage}
                        />
                        <View style={styles.concertHeaderOverlay}>
                            <Text style={styles.concertTitle}>{selectedConcert.title}</Text>
                        </View>
                    </View>

                    {/* Concert Info */}
                    <View style={styles.concertInfoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>🎤 Artists:</Text>
                            <Text style={styles.infoValue}>
                                {selectedConcert.artists.map(a => a.name).join(', ')}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📍 Venue:</Text>
                            <Text style={styles.infoValue}>
                                {selectedConcert.venue.name}, {selectedConcert.venue.location.city}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>📅 Date:</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(selectedConcert.dateTime)}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>🎵 Genre:</Text>
                            <Text style={styles.infoValue}>{selectedConcert.genre}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>👥 Attendees:</Text>
                            <Text style={styles.infoValue}>
                                {selectedConcert.attendees.toLocaleString()} expected
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>💰 Price:</Text>
                            <Text style={styles.infoValue}>
                                {selectedConcert.ticketInfo.priceRange?.min
                                    ? `$${selectedConcert.ticketInfo.priceRange.min} - $${selectedConcert.ticketInfo.priceRange.max}`
                                    : 'Price varies'
                                }
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => favoriteConcert(selectedConcert)}
                        >
                            <Text style={styles.actionButtonText}>⭐ Add to Favorites</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={() => {
                                // Track all artists in this concert
                                selectedConcert.artists.forEach(artist => {
                                    trackArtist(artist);
                                });
                            }}
                        >
                            <Text style={styles.secondaryButtonText}>👥 Track All Artists</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.calendarButton]}
                            onPress={() => addToCalendar(selectedConcert)}
                        >
                            <Text style={styles.calendarButtonText}>📅 Add to Calendar</Text>
                        </TouchableOpacity>

                        {selectedConcert.ticketInfo.url && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.ticketButton]}
                                onPress={() => {
                                    Linking.openURL(selectedConcert.ticketInfo.url).catch(err =>
                                        Alert.alert('Error', 'Could not open ticket link')
                                    );
                                }}
                            >
                                <Text style={styles.ticketButtonText}>🎫 Buy Tickets</Text>
                            </TouchableOpacity>
                        )}

                        {/* Share Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.shareButton]}
                            onPress={() => {
                                const shareMessage = `Check out ${selectedConcert.title} at ${selectedConcert.venue.name} on ${formatDate(selectedConcert.dateTime)} via TuneTrace!`;
                                Share.share({
                                    message: shareMessage,
                                    title: selectedConcert.title,
                                    url: selectedConcert.ticketInfo.url
                                }).catch(err => console.log('Share cancelled'));
                            }}
                        >
                            <Text style={styles.shareButtonText}>📤 Share Concert</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Price Alert Section */}
                    <View style={styles.priceAlertSection}>
                        <Text style={styles.sectionTitle}>💰 Price Alert</Text>
                        <Text style={styles.priceAlertDescription}>
                            Get notified when ticket prices drop
                        </Text>

                        <View style={styles.priceAlertInputContainer}>
                            <Text style={styles.currencySymbol}>$</Text>
                            <TextInput
                                style={styles.priceAlertInput}
                                placeholder="Enter target price"
                                value={priceAlertInput}
                                onChangeText={setPriceAlertInput}
                                keyboardType="numeric"
                            />
                            <TouchableOpacity
                                style={styles.setAlertButton}
                                onPress={() => {
                                    const targetPrice = parseFloat(priceAlertInput);
                                    if (isNaN(targetPrice) || targetPrice <= 0) {
                                        Alert.alert('Invalid Price', 'Please enter a valid price');
                                        return;
                                    }
                                    setPriceAlert(selectedConcert, targetPrice);
                                    setPriceAlertInput('');
                                }}
                            >
                                <Text style={styles.setAlertButtonText}>Set Alert</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Show existing alerts for this concert */}
                        {currentConcertAlerts.map(alert => (
                            <View key={alert.id} style={styles.existingAlertCard}>
                                <View style={styles.existingAlertHeader}>
                                    <Text style={styles.existingAlertText}>
                                        Alert: Below ${alert.targetPrice}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setPriceAlerts(prev => prev.filter(a => a.id !== alert.id));
                                            AsyncStorage.setItem('priceAlerts', JSON.stringify(
                                                priceAlerts.filter(a => a.id !== alert.id)
                                            ));
                                        }}
                                    >
                                        <Text style={styles.removeAlertText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.existingAlertDate}>
                                    Set {new Date(alert.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Similar Concerts Section */}
                    <View style={styles.similarConcertsSection}>
                        <Text style={styles.sectionTitle}>Similar Concerts</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {concerts
                                .filter(c =>
                                    c.id !== selectedConcert.id &&
                                    (c.genre === selectedConcert.genre ||
                                        c.artists.some(a => selectedConcert.artists.find(sa => sa.genre === a.genre)))
                                )
                                .slice(0, 5)
                                .map(concert => (
                                    <TouchableOpacity
                                        key={concert.id}
                                        style={styles.similarConcertCard}
                                        onPress={() => {
                                            setSelectedConcert(concert);
                                        }}
                                    >
                                        <Image
                                            source={{ uri: concert.artists[0]?.image }}
                                            style={styles.similarConcertImage}
                                        />
                                        <Text style={styles.similarConcertTitle} numberOfLines={1}>
                                            {concert.title}
                                        </Text>
                                        <Text style={styles.similarConcertDate}>
                                            {new Date(concert.dateTime).toLocaleDateString()}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            }
                        </ScrollView>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    };

    // Artist Search Screen
    const renderArtistSearchScreen = () => {
        const genres = ['All', 'Rock', 'Pop', 'Hip Hop', 'Jazz', 'EDM', 'R&B', 'Country', 'Metal', 'Indie'];

        const filteredArtists = artistSearchResults
            .filter(artist => selectedGenre === 'All' || artist.genre === selectedGenre)
            .sort((a, b) => {
                if (sortBy === 'name') {
                    return a.name.localeCompare(b.name);
                } else {
                    return parseInt(b.followers) - parseInt(a.followers);
                }
            });

        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>Search Artists</Text>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search for artists..."
                            value={artistSearchQuery}
                            onChangeText={setArtistSearchQuery}
                            onSubmitEditing={() => searchArtists(artistSearchQuery)}
                        />
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={() => searchArtists(artistSearchQuery)}
                        >
                            <Text style={styles.searchButtonText}>🔍</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Genre Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreContainer}>
                        {genres.map(genre => (
                            <TouchableOpacity
                                key={genre}
                                style={[
                                    styles.genreChip,
                                    selectedGenre === genre && styles.selectedGenreChip
                                ]}
                                onPress={() => setSelectedGenre(genre)}
                            >
                                <Text style={[
                                    styles.genreChipText,
                                    selectedGenre === genre && styles.selectedGenreChipText
                                ]}>
                                    {genre}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Sort Options */}
                    <View style={styles.sortContainer}>
                        <Text style={styles.sortLabel}>Sort by:</Text>
                        <TouchableOpacity
                            style={[styles.sortOption, sortBy === 'name' && styles.activeSortOption]}
                            onPress={() => setSortBy('name')}
                        >
                            <Text style={[styles.sortOptionText, sortBy === 'name' && styles.activeSortOptionText]}>
                                Name
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortOption, sortBy === 'followers' && styles.activeSortOption]}
                            onPress={() => setSortBy('followers')}
                        >
                            <Text style={[styles.sortOptionText, sortBy === 'followers' && styles.activeSortOptionText]}>
                                Popularity
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Results */}
                    {filteredArtists.length > 0 ? (
                        <FlatList
                            data={filteredArtists}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.artistCard}>
                                    <Image source={{ uri: item.image }} style={styles.artistImage} />
                                    <View style={styles.artistInfo}>
                                        <Text style={styles.artistName}>{item.name}</Text>
                                        <Text style={styles.artistGenre}>{item.genre}</Text>
                                        <Text style={styles.artistFollowers}>
                                            👥 {parseInt(item.followers).toLocaleString()} followers
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.trackButton}
                                        onPress={() => trackArtist(item)}
                                    >
                                        <Text style={styles.trackButtonText}>
                                            {trackedArtists.some(ta => ta.artistId === item.id) ? '✓ Tracked' : '+ Track'}
                                        </Text>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            )}
                            keyExtractor={item => item.id}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>🎵</Text>
                            <Text style={styles.emptyStateTitle}>
                                {artistSearchQuery ? 'No artists found' : 'Search for artists'}
                            </Text>
                            <Text style={styles.emptyStateText}>
                                {artistSearchQuery
                                    ? 'Try a different search term'
                                    : 'Enter an artist name to get started'
                                }
                            </Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    };

    // Tracked Artists Screen
    const renderTrackedArtistsScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Tracked Artists</Text>

                {trackedArtists.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateIcon}>🎤</Text>
                        <Text style={styles.emptyStateTitle}>No artists tracked yet</Text>
                        <Text style={styles.emptyStateText}>
                            Search for artists and tap "Track" to get notified about their concerts!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={trackedArtists}
                        renderItem={({ item }) => (
                            <View style={styles.trackedArtistCard}>
                                <Image source={{ uri: item.artistImage || `https://via.placeholder.com/150/007AFF/FFFFFF?text=${item.artistName.charAt(0)}` }} style={styles.trackedArtistImage} />
                                <View style={styles.trackedArtistInfo}>
                                    <Text style={styles.trackedArtistName}>{item.artistName}</Text>
                                    {item.genre && <Text style={styles.trackedArtistGenre}>{item.genre}</Text>}
                                    <Text style={styles.trackedDate}>Tracked since {new Date(item.createdAt).toLocaleDateString()}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.untrackButton}
                                    onPress={async () => {
                                        try {
                                            await apiFetch(`/api/artists/track/${item.artistId}`, {
                                                method: 'DELETE'
                                            });
                                            loadTrackedArtists();
                                            Alert.alert('Untracked', `You are no longer tracking ${item.artistName}`);
                                        } catch (error) {
                                            console.error('Failed to untrack:', error);
                                        }
                                    }}
                                >
                                    <Text style={styles.untrackButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        keyExtractor={(item) => item._id}
                    />
                )}
            </View>
        </SafeAreaView>
    );

    // Favorites Screen
    const renderFavoritesScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Favorite Concerts</Text>

                {favoriteConcerts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateIcon}>⭐</Text>
                        <Text style={styles.emptyStateTitle}>No favorite concerts yet</Text>
                        <Text style={styles.emptyStateText}>
                            Tap the heart icon on concerts to add them to your favorites!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={favoriteConcerts}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.favoriteCard}
                                onPress={() => {
                                    setSelectedConcert(item.concertData);
                                    setCurrentScreen('concertDetail');
                                }}
                            >
                                <Image
                                    source={{ uri: item.concertData.artists[0]?.image || 'https://via.placeholder.com/150' }}
                                    style={styles.favoriteImage}
                                />
                                <View style={styles.favoriteInfo}>
                                    <Text style={styles.favoriteTitle} numberOfLines={1}>
                                        {item.concertData.title}
                                    </Text>
                                    <Text style={styles.favoriteVenue}>
                                        {item.concertData.venue.name} • {item.concertData.venue.location.city}
                                    </Text>
                                    <Text style={styles.favoriteDate}>
                                        {formatDate(item.concertData.dateTime)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.removeFavoriteButton}
                                    onPress={async () => {
                                        try {
                                            await apiFetch(`/api/concerts/favorite/${item.concertId}`, {
                                                method: 'DELETE'
                                            });
                                            loadFavoriteConcerts();
                                        } catch (error) {
                                            console.error('Failed to remove favorite:', error);
                                        }
                                    }}
                                >
                                    <Text style={styles.removeFavoriteButtonText}>✕</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item._id}
                    />
                )}
            </View>
        </SafeAreaView>
    );

    // Login Screen
    const renderLoginScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.authContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.authScrollView}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => setCurrentScreen('home')}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.authTitle}>Welcome Back</Text>
                    <Text style={styles.authSubtitle}>Sign in to your account</Text>

                    <TextInput
                        style={styles.authInput}
                        placeholder="Email"
                        value={loginEmail}
                        onChangeText={setLoginEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TextInput
                        style={styles.authInput}
                        placeholder="Password"
                        value={loginPassword}
                        onChangeText={setLoginPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={styles.authButton}
                        onPress={handleLogin}
                        disabled={isLoggingIn}
                    >
                        {isLoggingIn ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.authButtonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.authSwitch}
                        onPress={() => setCurrentScreen('register')}
                    >
                        <Text style={styles.authSwitchText}>
                            Don't have an account? <Text style={styles.authSwitchHighlight}>Sign Up</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );

    // Register Screen
    const renderRegisterScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.authContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.authScrollView}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => setCurrentScreen('home')}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.authTitle}>Create Account</Text>
                    <Text style={styles.authSubtitle}>Join TuneTrace today</Text>

                    <TextInput
                        style={styles.authInput}
                        placeholder="Display Name"
                        value={registerDisplayName}
                        onChangeText={setRegisterDisplayName}
                    />

                    <TextInput
                        style={styles.authInput}
                        placeholder="Email"
                        value={registerEmail}
                        onChangeText={setRegisterEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TextInput
                        style={styles.authInput}
                        placeholder="Password (min. 6 characters)"
                        value={registerPassword}
                        onChangeText={setRegisterPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={styles.authButton}
                        onPress={handleRegister}
                        disabled={isRegistering}
                    >
                        {isRegistering ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.authButtonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.authSwitch}
                        onPress={() => setCurrentScreen('login')}
                    >
                        <Text style={styles.authSwitchText}>
                            Already have an account? <Text style={styles.authSwitchHighlight}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );

    // Profile Screen
    const renderProfileScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Profile</Text>

                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {user?.displayName?.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{user?.displayName}</Text>
                            <Text style={styles.profileEmail}>{user?.email}</Text>
                        </View>
                    </View>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{trackedArtists.length}</Text>
                            <Text style={styles.statLabel}>Artists Tracked</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{favoriteConcerts.length}</Text>
                            <Text style={styles.statLabel}>Favorites</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{notifications.length}</Text>
                            <Text style={styles.statLabel}>Notifications</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{priceAlerts.length}</Text>
                            <Text style={styles.statLabel}>Price Alerts</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.profileActionButton}
                        onPress={() => setCurrentScreen('notifications')}
                    >
                        <Text style={styles.profileActionButtonText}>View Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                        <Text style={styles.logoutButtonText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );

    // Notifications Screen
    const renderNotificationsScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <View style={styles.notificationsHeader}>
                    <Text style={styles.title}>Notifications</Text>
                    {notifications.length > 0 && (
                        <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
                            <Text style={styles.markAllButtonText}>Mark all read</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {notifications.length === 0 ? (
                    <View style={styles.emptyNotifications}>
                        <Text style={styles.emptyNotificationsIcon}>🔔</Text>
                        <Text style={styles.emptyNotificationsTitle}>No notifications yet</Text>
                        <Text style={styles.emptyNotificationsText}>
                            When you track artists, we'll notify you about new concerts and updates.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.notificationCard,
                                    !item.isRead && styles.unreadNotification
                                ]}
                                onPress={() => markAsRead(item._id)}
                                onLongPress={() => {
                                    Alert.alert(
                                        'Delete Notification',
                                        'Are you sure you want to delete this notification?',
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: () => deleteNotification(item._id)
                                            }
                                        ]
                                    );
                                }}
                            >
                                <View style={styles.notificationHeader}>
                                    <Text style={styles.notificationTitle}>{item.title}</Text>
                                    {!item.isRead && <View style={styles.unreadDot} />}
                                </View>
                                <Text style={styles.notificationMessage}>{item.message}</Text>
                                <Text style={styles.notificationTime}>
                                    {formatNotificationDate(item.createdAt)}
                                </Text>

                                {item.data?.concert && (
                                    <TouchableOpacity
                                        style={styles.notificationAction}
                                        onPress={() => {
                                            setSelectedConcert(item.data.concert);
                                            setCurrentScreen('concertDetail');
                                            markAsRead(item._id);
                                        }}
                                    >
                                        <Text style={styles.notificationActionText}>View Concert</Text>
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item._id}
                    />
                )}
            </View>
        </SafeAreaView>
    );

    // Price Alerts Screen
    const renderPriceAlertsScreen = () => (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('home')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Price Alerts</Text>

                {priceAlerts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateIcon}>💰</Text>
                        <Text style={styles.emptyStateTitle}>No price alerts yet</Text>
                        <Text style={styles.emptyStateText}>
                            Set price alerts for concerts to get notified when ticket prices drop.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={priceAlerts}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.priceAlertCard}
                                onPress={() => {
                                    const concert = concerts.find(c => c.id === item.concertId);
                                    if (concert) {
                                        setSelectedConcert(concert);
                                        setCurrentScreen('concertDetail');
                                    }
                                }}
                            >
                                <View style={styles.priceAlertHeader}>
                                    <Text style={styles.priceAlertConcert} numberOfLines={1}>
                                        {item.concertTitle}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            Alert.alert(
                                                'Remove Alert',
                                                'Are you sure you want to remove this price alert?',
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'Remove',
                                                        style: 'destructive',
                                                        onPress: () => {
                                                            setPriceAlerts(prev =>
                                                                prev.filter(alert => alert.id !== item.id)
                                                            );
                                                            AsyncStorage.setItem('priceAlerts', JSON.stringify(
                                                                priceAlerts.filter(alert => alert.id !== item.id)
                                                            ));
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.removeAlertText}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.priceAlertArtist}>{item.artistName}</Text>
                                <View style={styles.priceAlertInfo}>
                                    <Text style={styles.priceAlertTarget}>
                                        Target: <Text style={styles.priceAlertAmount}>${item.targetPrice}</Text>
                                    </Text>
                                    <Text style={styles.priceAlertStatus}>
                                        {item.isActive ? '🟢 Active' : '⚪ Inactive'}
                                    </Text>
                                </View>
                                <Text style={styles.priceAlertDate}>
                                    Set on {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>
                        )}
                        keyExtractor={item => item.id}
                    />
                )}
            </View>
        </SafeAreaView>
    );

    // Show loading while checking auth
    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.appContainer}>
            {currentScreen === 'home' && renderHomeScreen()}
            {currentScreen === 'concertDetail' && renderConcertDetailScreen()}
            {currentScreen === 'artistSearch' && renderArtistSearchScreen()}
            {currentScreen === 'trackedArtists' && renderTrackedArtistsScreen()}
            {currentScreen === 'favorites' && renderFavoritesScreen()}
            {currentScreen === 'login' && renderLoginScreen()}
            {currentScreen === 'register' && renderRegisterScreen()}
            {currentScreen === 'profile' && renderProfileScreen()}
            {currentScreen === 'notifications' && renderNotificationsScreen()}
            {currentScreen === 'priceAlerts' && renderPriceAlertsScreen()}
        </View>
    );
};

// Main App Component
export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </SafeAreaProvider>
    );
}

// ================== STYLES ==================
const styles = StyleSheet.create({
    // Base styles
    safeArea: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    appContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        color: '#1a1a1a',
    },

    // Home screen styles
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    notificationButton: {
        position: 'relative',
        marginRight: 12,
        padding: 8,
    },
    notificationIcon: {
        fontSize: 20,
    },
    notificationBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    authHeaderButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    authHeaderButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },

    // Status indicator
    statusIndicator: {
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
        alignItems: 'center',
    },
    statusText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },

    // Navigation buttons
    navButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    navButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 8,
        flex: 1,
        marginHorizontal: 4,
        marginBottom: 8,
        alignItems: 'center',
    },
    navButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },

    // Search and filters
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 10,
        fontSize: 16,
    },
    searchButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    filterButton: {
        backgroundColor: '#34C759',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    filterButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },

    // Results info
    resultsInfo: {
        backgroundColor: '#e3f2fd',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    resultsText: {
        textAlign: 'center',
        color: '#1976d2',
        fontWeight: '500',
    },

    // Concert cards
    concertCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    artistImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
    },
    concertInfo: {
        flex: 1,
    },
    artistName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    venue: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    date: {
        fontSize: 12,
        color: '#888',
        marginBottom: 4,
    },
    genre: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    price: {
        fontSize: 16,
        fontWeight: '600',
        color: '#e91e63',
    },
    favoriteButton: {
        padding: 8,
    },
    favoriteButtonText: {
        color: '#e91e63',
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16,
    },

    // Footer
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        color: '#666',
        textAlign: 'center',
    },
    loadMoreButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        margin: 20,
    },
    loadMoreButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loadMoreSubtext: {
        color: 'white',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
    },

    // Back button
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 20,
        paddingVertical: 8,
        paddingHorizontal: 0,
    },
    backButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        width: '80%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalButtons: {
        marginTop: 20,
        gap: 10,
    },

    // Auth screens
    authContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    authScrollView: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    authTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
        color: '#1a1a1a',
    },
    authSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        color: '#666',
    },
    authInput: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 16,
        fontSize: 16,
    },
    authButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    authButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    authSwitch: {
        alignItems: 'center',
    },
    authSwitchText: {
        color: '#666',
        fontSize: 16,
    },
    authSwitchHighlight: {
        color: '#007AFF',
        fontWeight: 'bold',
    },

    // Profile
    profileCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 16,
        color: '#666',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingVertical: 15,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f0f0f0',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
    },
    profileActionButton: {
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    profileActionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Notifications
    notificationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    markAllButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    markAllButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyNotifications: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyNotificationsIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyNotificationsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    emptyNotificationsText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
    notificationCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    unreadNotification: {
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#007AFF',
    },
    notificationMessage: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        lineHeight: 20,
    },
    notificationTime: {
        fontSize: 12,
        color: '#999',
        marginBottom: 12,
    },
    notificationAction: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    notificationActionText: {
        color: '#007AFF',
        fontSize: 12,
        fontWeight: '600',
    },

    // Concert Detail
    concertHeader: {
        position: 'relative',
        height: 200,
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    concertImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    concertHeaderOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 16,
    },
    concertTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    concertInfoCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    infoValue: {
        fontSize: 16,
        color: '#666',
        flex: 2,
        textAlign: 'right',
    },
    actionButtonsContainer: {
        marginBottom: 20,
    },
    actionButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
    },
    secondaryButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    calendarButton: {
        backgroundColor: '#FF9500',
    },
    calendarButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    ticketButton: {
        backgroundColor: '#FF3B30',
    },
    ticketButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    shareButton: {
        backgroundColor: '#34C759',
    },
    shareButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },

    // Price Alert
    priceAlertSection: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    priceAlertDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 15,
    },
    priceAlertInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    currencySymbol: {
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
        color: '#333',
    },
    priceAlertInput: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
    },
    setAlertButton: {
        backgroundColor: '#FF9500',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginLeft: 10,
    },
    setAlertButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    existingAlertCard: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#34C759',
    },
    existingAlertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    existingAlertText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    removeAlertText: {
        fontSize: 18,
        color: '#FF3B30',
        fontWeight: 'bold',
        marginLeft: 10,
    },
    existingAlertDate: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    priceAlertCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#FF9500',
    },
    priceAlertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    priceAlertConcert: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        marginRight: 10,
    },
    priceAlertArtist: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    priceAlertInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    priceAlertTarget: {
        fontSize: 14,
        color: '#333',
    },
    priceAlertAmount: {
        fontWeight: 'bold',
        color: '#FF9500',
    },
    priceAlertStatus: {
        fontSize: 12,
        color: '#666',
    },
    priceAlertDate: {
        fontSize: 12,
        color: '#999',
    },

    // Similar Concerts
    similarConcertsSection: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    similarConcertCard: {
        width: 150,
        marginRight: 12,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    similarConcertImage: {
        width: 126,
        height: 100,
        borderRadius: 6,
        marginBottom: 8,
    },
    similarConcertTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
        color: '#333',
    },
    similarConcertDate: {
        fontSize: 12,
        color: '#666',
    },

    // Artist Search
    genreContainer: {
        marginBottom: 15,
    },
    genreChip: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    selectedGenreChip: {
        backgroundColor: '#007AFF',
    },
    genreChipText: {
        color: '#666',
        fontSize: 14,
    },
    selectedGenreChipText: {
        color: 'white',
        fontWeight: '600',
    },
    sortContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sortLabel: {
        fontSize: 16,
        marginRight: 12,
        color: '#666',
    },
    sortOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginRight: 8,
        backgroundColor: '#f0f0f0',
    },
    activeSortOption: {
        backgroundColor: '#007AFF',
    },
    sortOptionText: {
        fontSize: 14,
        color: '#666',
    },
    activeSortOptionText: {
        color: 'white',
        fontWeight: '600',
    },
    artistCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    artistInfo: {
        flex: 1,
    },
    artistName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    artistGenre: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    artistFollowers: {
        fontSize: 12,
        color: '#888',
    },
    trackButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    trackButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },

    // Tracked Artists
    trackedArtistCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    trackedArtistImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    trackedArtistInfo: {
        flex: 1,
    },
    trackedArtistName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    trackedArtistGenre: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    trackedDate: {
        fontSize: 12,
        color: '#888',
    },
    untrackButton: {
        padding: 8,
    },
    untrackButtonText: {
        color: '#FF3B30',
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Favorites
    favoriteCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    favoriteImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    favoriteInfo: {
        flex: 1,
    },
    favoriteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    favoriteVenue: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    favoriteDate: {
        fontSize: 12,
        color: '#888',
    },
    removeFavoriteButton: {
        padding: 8,
    },
    removeFavoriteButtonText: {
        color: '#FF3B30',
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Empty states
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyStateIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },

    // Empty text
    emptyText: {
        textAlign: 'center',
        color: '#666',
        marginTop: 50,
        fontSize: 16,
    },
});