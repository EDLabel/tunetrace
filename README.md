# 🎵 TuneTrace - Concert Discovery App

TuneTrace is a mobile application built with React Native that helps users discover concerts, track their favorite artists, and save upcoming events. The app connects to multiple music APIs to provide comprehensive concert listings.

# ✨ Features

## Concert Discovery

- Search concerts by city and genre

- View detailed concert information including artists, venue, date, and pricing

- Real-time data from Ticketmaster API

- Offline support with cached data

## User Management

- Secure authentication (register/login)

- User profiles with activity stats

- Tracked artists and favorite concerts

- Personalized notifications

## Artist Tracking

- Search and follow your favorite artists

- Get notified when tracked artists announce new concerts

- View all tracked artists in one place

## Price Alerts

- Set target prices for concerts

- Get notified when ticket prices drop

- Manage all price alerts in one screen

## Real-time Notifications

- WebSocket-based real-time updates

- Concert announcements for tracked artists

- Price drop alerts

- Mark as read and delete functionality

## Calendar Integration

- Add concerts directly to device calendar

- Automatically sets 2-hour event duration

- Includes venue and artist information

## Favorites System

- Save your favorite concerts

- Quick access to saved events

- Remove favorites when no longer needed

## Tech Stack

- Frontend: React Native, TypeScript

- State Management: React Hooks, Context API

- Navigation: Screen-based navigation

- Storage: AsyncStorage for offline data

- Authentication: JWT tokens

- Real-time: WebSocket connections

- Calendar: Expo Calendar API

- Sharing: React Native Share API

- Styling: React Native StyleSheet

### Technical Features
- **Cross-platform**: Built with React Native for iOS and Android
- **Backend Integration**: Connects to custom Node.js API
- **Offline Support**: Caches data for offline access
- **Push Notifications**: Get alerts for new concerts (coming soon)

# Quick Start

## Prerequisites
**Before running this project, ensure you have:**

- Node.js 16+ installed

- Expo CLI installed globally

- iOS Simulator (for Mac) or Android Studio (for Android)

- Backend server running (see setup below)

### Installation

1. **Clone the repository**
```
git clone <your-repository-url>
cd tunetrace/mobile
```
2. **Install dependencies**
```
npm install
# or
yarn install
```
3. **Set up environment**

   - Update the IP address in App.tsx (line 16)

   - Make sure your backend server is running
   
4. **Run the app**
```
npx expo start
```

- Press i to open iOS simulator

- Press a to open Android emulator

- Scan QR code with Expo Go app on physical device

# Screens

## Home Screen

- Search concerts by city

- View all upcoming concerts

- Quick navigation to all features

- Backend connection status

## Concert Detail Screen

- Complete concert information

- Price alert setting

- Add to calendar

- Share with friends

- Track all artists

## Artist Search Screen

- Search artists by name

- Filter by genre (Rock, Pop, Hip Hop, etc.)

- Sort by name or popularity

- Track/untrack artists

## Tracked Artists Screen

- View all followed artists

- See tracking duration

- One-tap untrack

## Favorites Screen

- All saved concerts

- Quick access to favorite events

- Remove favorites

## Notifications Screen

- Real-time notifications

- Mark as read/delete

- Priority alerts with popups

## Price Alerts Screen

- Manage all price alerts

- View alert status (active/inactive)

- Remove alerts

## Profile Screen

- User information

- Activity statistics

- Logout functionality

### Backend Setup

**The mobile app requires a backend server. Set it up separately:**
1. **Clone the backend repository**
```
git clone <your-repository-url>
cd tunetrace/backend
```
2. **Install and run backend**
```
npm install
npm run dev
```
3. **Configure API endpoints in the mobile app**

## Project Structure
```
mobile/
├── App.tsx              # Main application component
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── tsconfig.json      # TypeScript configuration
├── assets/            # Images, fonts, etc.
└── components/        # Reusable components (if any)
```
# Configuration

## Environment Setup

1. IP Address Configuration:

- Update YOUR_COMPUTER_IP in App.tsx to match your computer's IP

- Ensure both mobile device and backend are on same network

2. Backend API:

- The app expects backend running at http://YOUR_IP:3000

- WebSocket connection at ws://YOUR_IP:3000

3. Calendar Permissions:

- iOS: Add NSCalendarsUsageDescription to Info.plist

- Android: Add calendar permissions to AndroidManifest.xml

## Dependencies
### Core Dependencies
```
{
"react": "18.2.0",
"react-native": "0.73.6",
"expo": "~50.0.0",
"@react-native-async-storage/async-storage": "1.21.0",
"react-native-safe-area-context": "4.8.2",
"expo-calendar": "~12.7.0"
}
```

## Troubleshooting

### Common Issues

1. Backend Connection Failed

   - Check if backend server is running

   - Verify IP address in App.tsx

   - Ensure devices are on same network

2. WebSocket Not Connecting

   - Check backend WebSocket server

   - Verify authentication token

   - Check network permissions

3. Calendar Integration Not Working

   - Ensure calendar permissions are granted

   - Check device calendar app

4. Images Not Loading

   - Check internet connection

   - Verify image URLs in concert data

## Design Principles

- Minimalist Design: Clean interface focused on content

- Consistent Color Scheme: Blue (#007AFF) primary with supporting colors

- Card-Based Layout: Information presented in clear cards

- Responsive Design: Works on both iOS and Android

- Accessibility: Proper contrast ratios and touch targets

## Security Features

- JWT token authentication

- Secure credential storage

- Protected API endpoints

- Input validation

- Error boundary handling

## Performance Optimizations

- FlatList for efficient scrolling

- Image caching

- Lazy loading of concert data

- Offline data persistence

- WebSocket for real-time updates

## Version History
### v1.0.0 (Current)

- Initial release

- Basic concert discovery

- Artist tracking

- User authentication

- Favorite system

### Planned Features (v1.1.0)

- Dark mode

- Social sharing

- Concert reminders

- Advanced filters

- Offline mode

## Contributing

**We welcome contributions! Please follow these steps:**

- Fork the repository

- Create a feature branch (git checkout -b feature/AmazingFeature)

- Commit your changes (git commit -m 'Add some AmazingFeature')

- Push to the branch (git push origin feature/AmazingFeature)

- Open a Pull Request

## License
**This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.**

## Support

- For support, please:

- Check the Issues page

- Create a new issue if your problem isn't listed

## Acknowledgements

- [Ticketmaster API](https://developer.ticketmaster.com/) for concert data

- [Expo](https://expo.dev/) for the amazing development platform

- React Native community for excellent libraries

**Happy concert hunting!** 🎶