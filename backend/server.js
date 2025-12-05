const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const User = require('./models/User');
const TrackedArtist = require('./models/TrackedArtist');
const FavoriteConcert = require('./models/FavoriteConcert');
const Notification = require('./models/Notification');

const app = express();
const server = http.createServer(app);

// WebSocket Server for Real-time Notifications
const wss = new WebSocket.Server({ server });
const connectedClients = new Map(); // userId -> WebSocket

// WebSocket Connection Handler
wss.on('connection', (ws, req) => {
    console.log('🔌 New WebSocket connection');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'AUTHENTICATE') {
                // Verify JWT token and associate WebSocket with user
                jwt.verify(data.token, process.env.JWT_SECRET || 'your_fallback_secret', (err, user) => {
                    if (err) {
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            message: 'Authentication failed'
                        }));
                        ws.close();
                        return;
                    }

                    connectedClients.set(user.userId, ws);
                    console.log(`✅ User ${user.userId} connected to WebSocket`);

                    ws.send(JSON.stringify({
                        type: 'AUTHENTICATED',
                        message: 'WebSocket connection established'
                    }));
                });
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        // Remove from connected clients
        for (const [userId, clientWs] of connectedClients.entries()) {
            if (clientWs === ws) {
                connectedClients.delete(userId);
                console.log(`❌ User ${userId} disconnected from WebSocket`);
                break;
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Function to send notification to user
const sendNotificationToUser = (userId, notification) => {
    const clientWs = connectedClients.get(userId);
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
            type: 'NEW_NOTIFICATION',
            notification
        }));
        console.log(`📨 Sent real-time notification to user ${userId}`);
    }
};

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    credentials: true
}));

// Middleware
app.use(express.json());

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_fallback_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Ticketmaster API configuration
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || 'YOUR_TICKETMASTER_API_KEY';
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// Background Job: Check for new concerts for tracked artists
const checkTrackedArtistsForNewConcerts = async () => {
    try {
        console.log('🔍 Checking for new concerts for tracked artists...');

        // Get all tracked artists across all users
        const trackedArtists = await TrackedArtist.find().populate('userId');

        for (const trackedArtist of trackedArtists) {
            try {
                // Check if we have Ticketmaster API key
                if (!TICKETMASTER_API_KEY || TICKETMASTER_API_KEY === 'YOUR_TICKETMASTER_API_KEY') {
                    // Mock new concert detection for demo
                    if (Math.random() < 0.1) { // 10% chance to simulate new concert
                        const mockConcert = {
                            id: `new-${Date.now()}-${trackedArtist.artistId}`,
                            title: `New ${trackedArtist.artistName} Concert!`,
                            artists: [{
                                name: trackedArtist.artistName,
                                id: trackedArtist.artistId,
                                image: trackedArtist.artistImage
                            }],
                            venue: {
                                name: 'New Venue',
                                location: {
                                    city: 'New York',
                                    country: 'USA'
                                }
                            },
                            dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
                            ticketInfo: {
                                onSale: true
                            },
                            genre: trackedArtist.genre
                        };

                        // Create notification
                        const notification = new Notification({
                            userId: trackedArtist.userId._id,
                            type: 'NEW_CONCERT',
                            title: 'New Concert Alert!',
                            message: `${trackedArtist.artistName} just announced a new concert in New York!`,
                            data: {
                                artistId: trackedArtist.artistId,
                                artistName: trackedArtist.artistName,
                                concert: mockConcert
                            },
                            priority: 'high'
                        });

                        await notification.save();

                        // Send real-time notification
                        sendNotificationToUser(trackedArtist.userId._id.toString(), {
                            _id: notification._id,
                            type: notification.type,
                            title: notification.title,
                            message: notification.message,
                            data: notification.data,
                            isRead: notification.isRead,
                            createdAt: notification.createdAt
                        });

                        console.log(`🎵 Created notification for new ${trackedArtist.artistName} concert for user ${trackedArtist.userId.displayName}`);
                    }
                } else {
                    // Real Ticketmaster API check would go here
                    // This is a simplified version - in production you'd want to cache and compare
                    console.log(`Would check Ticketmaster for ${trackedArtist.artistName}`);
                }
            } catch (error) {
                console.error(`Error checking artist ${trackedArtist.artistName}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in background concert check:', error);
    }
};

// Run background job every 5 minutes (for demo - in production this would be less frequent)
setInterval(checkTrackedArtistsForNewConcerts, 5 * 60 * 1000);

// Public Routes

// Health check with WebSocket info
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'TuneTrace Backend is running!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ticketmaster: !!TICKETMASTER_API_KEY,
        authentication: true,
        websocket: {
            connectedClients: connectedClients.size,
            enabled: true
        }
    });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        // Validation
        if (!email || !password || !displayName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Create user
        const user = new User({
            email,
            password,
            displayName
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your_fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error during registration' });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your_fallback_secret',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// Get user profile (protected)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Get user notifications (protected)
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const notifications = await Notification.find({
            userId: req.user.userId
        })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notification.countDocuments({
            userId: req.user.userId
        });

        res.json({
            notifications,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read (protected)
app.patch('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.notificationId,
                userId: req.user.userId
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ notification });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read (protected)
app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany(
            {
                userId: req.user.userId,
                isRead: false
            },
            { isRead: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// Get unread notification count (protected)
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.user.userId,
            isRead: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// Delete notification (protected)
app.delete('/api/notifications/:notificationId', authenticateToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.notificationId,
            userId: req.user.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// Public concert search
app.get('/api/concerts', async (req, res) => {
    try {
        const {
            city = 'New York',
            genre,
            date,
            page = 0,
            size = 10,
            loadMore = 'false'
        } = req.query;

        const currentPage = parseInt(page);
        const pageSize = parseInt(size);
        const isLoadMore = loadMore === 'true';

        // If no Ticketmaster API key, return mock data
        if (!TICKETMASTER_API_KEY || TICKETMASTER_API_KEY === 'YOUR_TICKETMASTER_API_KEY') {
            const mockData = await getMockConcerts(city, genre, currentPage, pageSize);
            return res.json(mockData);
        }

        // Build Ticketmaster API URL
        let url = `${TICKETMASTER_BASE_URL}/events.json`;
        let params = {
            apikey: TICKETMASTER_API_KEY,
            classificationName: 'music',
            city: city,
            size: pageSize,
            page: currentPage,
            sort: 'date,asc'
        };

        if (genre) params.keyword = genre;
        if (date) params.localStartDateTime = `${date}T00:00:00,${date}T23:59:59`;

        const response = await axios.get(url, { params });
        const data = response.data;

        if (!data._embedded || !data._embedded.events) {
            return res.json({
                concerts: [],
                total: 0,
                page: currentPage,
                totalPages: 0,
                hasNextPage: false,
                city,
                message: 'No concerts found for this location'
            });
        }

        // Transform Ticketmaster data
        const concerts = data._embedded.events.map(event => ({
            id: event.id,
            title: event.name,
            artists: event._embedded.attractions ? event._embedded.attractions.map(attraction => ({
                name: attraction.name,
                id: attraction.id,
                image: attraction.images ? attraction.images[0].url : 'https://via.placeholder.com/150/666666/FFFFFF?text=Artist'
            })) : [{
                name: 'Various Artists',
                id: 'unknown',
                image: 'https://via.placeholder.com/150/666666/FFFFFF?text=Artist'
            }],
            venue: {
                name: event._embedded.venues[0].name,
                location: {
                    address: event._embedded.venues[0].address?.line1 || 'Address not available',
                    city: event._embedded.venues[0].city.name,
                    country: event._embedded.venues[0].country.name,
                    coordinates: {
                        latitude: parseFloat(event._embedded.venues[0].location?.latitude) || 40.7128,
                        longitude: parseFloat(event._embedded.venues[0].location?.longitude) || -74.0060
                    }
                }
            },
            dateTime: event.dates.start.dateTime || event.dates.start.localDate + 'T20:00:00',
            ticketInfo: {
                url: event.url,
                priceRange: event.priceRanges ? event.priceRanges[0] : { min: 0, max: 0, currency: 'USD' },
                onSale: event.dates.status.code === 'onsale'
            },
            attendees: Math.floor(Math.random() * 5000) + 100,
            genre: event.classifications ? event.classifications[0].genre.name : 'Music'
        }));

        const totalElements = data.page?.totalElements || concerts.length;
        const totalPages = data.page?.totalPages || Math.ceil(totalElements / pageSize);
        const hasNextPage = currentPage < totalPages - 1;

        res.json({
            concerts,
            total: totalElements,
            page: currentPage,
            totalPages,
            hasNextPage,
            pageSize,
            city,
            source: 'Ticketmaster API',
            isLoadMore
        });

    } catch (error) {
        console.error('Ticketmaster API Error:', error.message);
        const { city, genre, page = 0, size = 10 } = req.query;
        res.json(await getMockConcerts(city, genre, parseInt(page), parseInt(size)));
    }
});

// Protected Routes (require authentication)

// Track an artist
app.post('/api/artists/track', authenticateToken, async (req, res) => {
    try {
        const { artistId, artistName, artistImage, genre } = req.body;

        if (!artistId || !artistName) {
            return res.status(400).json({ error: 'Artist ID and name are required' });
        }

        // Check if already tracked by this user
        const existingTrack = await TrackedArtist.findOne({
            userId: req.user.userId,
            artistId
        });

        if (existingTrack) {
            return res.json({
                message: 'Artist already tracked',
                artist: existingTrack
            });
        }

        const trackedArtist = new TrackedArtist({
            userId: req.user.userId,
            artistId,
            artistName,
            artistImage,
            genre
        });

        await trackedArtist.save();

        res.json({
            message: 'Artist tracked successfully',
            artist: trackedArtist
        });
    } catch (error) {
        console.error('Track artist error:', error);
        res.status(500).json({ error: 'Failed to track artist' });
    }
});

// Get user's tracked artists
app.get('/api/artists/tracked', authenticateToken, async (req, res) => {
    try {
        const trackedArtists = await TrackedArtist.find({
            userId: req.user.userId
        }).sort({ trackedAt: -1 });

        res.json({ artists: trackedArtists });
    } catch (error) {
        console.error('Get tracked artists error:', error);
        res.status(500).json({ error: 'Failed to fetch tracked artists' });
    }
});

// Untrack an artist
app.delete('/api/artists/track/:artistId', authenticateToken, async (req, res) => {
    try {
        const { artistId } = req.params;

        await TrackedArtist.findOneAndDelete({
            userId: req.user.userId,
            artistId
        });

        res.json({ message: 'Artist untracked successfully' });
    } catch (error) {
        console.error('Untrack artist error:', error);
        res.status(500).json({ error: 'Failed to untrack artist' });
    }
});

// Add concert to favorites
app.post('/api/concerts/favorite', authenticateToken, async (req, res) => {
    try {
        const { concertId, concertData } = req.body;

        if (!concertId || !concertData) {
            return res.status(400).json({ error: 'Concert ID and data are required' });
        }

        // Check if already favorited by this user
        const existingFavorite = await FavoriteConcert.findOne({
            userId: req.user.userId,
            concertId
        });

        if (existingFavorite) {
            return res.json({
                message: 'Concert already in favorites',
                favorite: existingFavorite
            });
        }

        const favorite = new FavoriteConcert({
            userId: req.user.userId,
            concertId,
            concertData
        });

        await favorite.save();

        res.json({
            message: 'Concert added to favorites',
            favorite
        });
    } catch (error) {
        console.error('Favorite concert error:', error);
        res.status(500).json({ error: 'Failed to favorite concert' });
    }
});

// Get user's favorite concerts
app.get('/api/concerts/favorites', authenticateToken, async (req, res) => {
    try {
        const favorites = await FavoriteConcert.find({
            userId: req.user.userId
        }).sort({ favoritedAt: -1 });

        res.json({ favorites });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ error: 'Failed to fetch favorite concerts' });
    }
});

// Remove concert from favorites
app.delete('/api/concerts/favorite/:concertId', authenticateToken, async (req, res) => {
    try {
        const { concertId } = req.params;

        await FavoriteConcert.findOneAndDelete({
            userId: req.user.userId,
            concertId
        });

        res.json({ message: 'Concert removed from favorites' });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: 'Failed to remove concert from favorites' });
    }
});

// Search artists (public)
app.get('/api/artists/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.json({ artists: [] });
        }

        // Mock artist search results
        const mockArtists = [
            { id: 'artist1', name: 'The Killers', image: 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=Killers', followers: '2.5M', genre: 'Rock' },
            { id: 'artist2', name: 'Arctic Monkeys', image: 'https://via.placeholder.com/150/4ECDC4/FFFFFF?text=AM', followers: '3.1M', genre: 'Rock' },
            { id: 'artist3', name: 'Norah Jones', image: 'https://via.placeholder.com/150/45B7D1/FFFFFF?text=Norah', followers: '1.8M', genre: 'Jazz' },
            { id: 'artist4', name: 'Martin Garrix', image: 'https://via.placeholder.com/150/F7DC6F/000000?text=MG', followers: '4.2M', genre: 'EDM' },
            { id: 'artist5', name: 'David Guetta', image: 'https://via.placeholder.com/150/BB8FCE/FFFFFF?text=DG', followers: '3.9M', genre: 'EDM' },
            { id: 'artist6', name: 'Kendrick Lamar', image: 'https://via.placeholder.com/150/E74C3C/FFFFFF?text=KL', followers: '8.7M', genre: 'Hip Hop' },
            { id: 'artist7', name: 'J. Cole', image: 'https://via.placeholder.com/150/3498DB/FFFFFF?text=JC', followers: '7.2M', genre: 'Hip Hop' },
            { id: 'artist8', name: 'Beyoncé', image: 'https://via.placeholder.com/150/9B59B6/FFFFFF?text=Bey', followers: '6.8M', genre: 'R&B' }
        ];

        const filteredArtists = mockArtists.filter(artist =>
            artist.name.toLowerCase().includes(query.toLowerCase()) ||
            artist.genre.toLowerCase().includes(query.toLowerCase())
        );

        res.json({
            artists: filteredArtists,
            total: filteredArtists.length,
            source: 'Mock Data'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to search artists' });
    }
});

// Mock data function (same as before)
async function getMockConcerts(city = 'New York', genre = '', page = 0, pageSize = 10) {
    // ... (keep your existing mock data function exactly as it was)
    // This should be the same 25 concerts from before
    // [Previous mock data implementation remains the same]
}

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tunetrace');
        console.log('MongoDB Connected successfully');
    } catch (error) {
        console.log('MongoDB connection failed:', error);
        process.exit(1);
    }
};

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();

    server.listen(PORT, () => {
        console.log(`TuneTrace Backend running on http://localhost:${PORT}`);
        console.log(`Network access: http://YOUR_IP:${PORT}`);
        console.log(`WebSocket Server: Running on same port`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
        console.log(`Real Concert Data: ${TICKETMASTER_API_KEY ? 'ENABLED' : 'DISABLED - Set TICKETMASTER_API_KEY in .env'}`);
        console.log(`Authentication: ENABLED`);
        console.log(`Real-time Notifications: ENABLED`);
        console.log(`Pagination: ENABLED`);
        console.log(`Background Jobs: Running every 5 minutes`);
    });
};

startServer();