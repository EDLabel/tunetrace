# 🎵 TuneTrace - Concert Discovery App

TuneTrace is a mobile application built with React Native that helps users discover concerts, track their favorite artists, and save upcoming events. The app connects to multiple music APIs to provide comprehensive concert listings.

## ✨ Features

### 🎤 Core Features
- **Concert Discovery**: Browse concerts by city and genre
- **Artist Tracking**: Follow your favorite artists and get notifications
- **Favorites System**: Save concerts for later reference
- **Real-time Updates**: Get the latest concert information
- **Multi-source Data**: Aggregates data from multiple ticketing platforms

### 👤 User Features
- **Authentication**: Secure login/register system
- **Personalized Dashboard**: Track your artists and saved concerts
- **Search & Filters**: Find concerts by location, genre, and date
- **Price Tracking**: View ticket price ranges in real-time

### 🛠️ Technical Features
- **Cross-platform**: Built with React Native for iOS and Android
- **Backend Integration**: Connects to custom Node.js API
- **Offline Support**: Caches data for offline access
- **Push Notifications**: Get alerts for new concerts (coming soon)

## 📱 Screens

1. **Home Screen**: Browse concerts with search and filters
2. **Concert Details**: View detailed information about events
3. **Artist Search**: Find and track artists
4. **Tracked Artists**: Manage your followed artists
5. **Favorites**: View saved concerts
6. **Profile**: User account management

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/EDLabel/tunetrace.git
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
# For iOS
npx expo start --ios

# For Android
npx expo start --android

# Or use the Expo Go app on your phone
npx expo start
```
### Backend Setup
The mobile app requires a backend server. Set it up separately:
1. **Clone the backend repository**
```
git clone https://github.com/EDLabel/tunetrace-backend.git
cd tunetrace-backend
```
2. **Install and run backend**
```
npm install
npm start
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
## Configuration

### API Configuration

**Update the API base URL in App.tsx:**
```
const YOUR_COMPUTER_IP = '192.168.1.100'; // Change to your IP
const API_BASE = `http://${YOUR_COMPUTER_IP}:3000`;
```
## Dependencies
### Core Dependencies
- React Native 0.72+

- Expo SDK 49+

- TypeScript

- React Navigation

- React Native Safe Area Context

### Key Packages

- @react-native-async-storage/async-storage: Local storage

- react-native-safe-area-context: Safe area handling

- expo-constants: App constants

- expo-status-bar: Status bar management

## Testing
**Run tests with:**
```
npm test
# or
yarn test
```

## Authentication
**The app uses JWT-based authentication with:**

- Email/password registration

- Secure token storage

- Protected routes

- Automatic session management

## API Documentation
### Endpoints
- GET /api/concerts - Get concerts by city

- POST /api/auth/login - User login

- POST /api/auth/register - User registration

- GET /api/artists/search - Search artists

- POST /api/artists/track - Track an artist

- GET /api/concerts/favorites - Get user favorites

## UI/UX Features
- Responsive Design: Works on all screen sizes

- Dark Mode: Coming soon

- Smooth Animations: Native-like transitions

- Accessibility: VoiceOver and TalkBack support

## Platform Support
| Platform    | 	Version|	Status |
|------------|---------|------------------|
| iOS| 	13.0+          |	✅ Fully Supported|
| Android| 	8.0+           | 	✅ Fully Supported |

## Version History
### v1.0.0 (Current)

- Initial release

- Basic concert discovery

- Artist tracking

- User authentication

- Favorite system

### Planned Features (v1.1.0)

- Push notifications

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

## Code Style
- Follow TypeScript best practices

- Use functional components with hooks

- Write meaningful comments

- Add tests for new features

## License
**This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.**

## Support

- For support, please:

- Check the Issues page

- Create a new issue if your problem isn't listed

## Acknowledgements

- [Ticketmaster API](https://developer.ticketmaster.com/) for concert data

- [Spotify API](https://developer.spotify.com/) for artist information

- [Expo](https://expo.dev/) for the amazing development platform

- React Native community for excellent libraries

## Analytics
**The app collects anonymous usage data to improve features:**

- Feature usage statistics

- Crash reports

- Performance metrics

**You can opt out in Settings.**

## Made with ❤️ by the TuneTrace team

**Happy concert hunting!** 🎶