# Water Meter Readings App

A comprehensive web application built with React, TypeScript, and Material UI for water utility workers to efficiently collect, validate, and manage water meter readings. This application provides a structured workflow with robust data validation to ensure accuracy in the meter reading process.

## Features

- **User Authentication**: Secure login functionality using Firebase Authentication with reCAPTCHA verification
- **Route Management**: Organizes meters by geographical routes for efficient data collection
- **Historical Data Analysis**: Displays previous readings and consumption patterns for context
- **Advanced Data Validation**:
  - Low consumption detection with verification workflow
  - High consumption alerts with threshold-based warnings
  - Negative consumption checks to prevent impossible readings
  - Comprehensive verification process for anomalies
- **Field Verification Tools**:
  - Residence occupancy checks
  - Photo documentation capabilities
  - Detailed notes for special circumstances
  - "Can't read meter" workflow with reason documentation
- **Offline Support**: Local storage for working in areas with limited connectivity
- **Summary Dashboard**: Comprehensive view of all collected readings with status indicators
- **Quality Control**: Validation checks before final submission
- **Data Export**: Submit validated data to Firebase Firestore with photo storage

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **UI Framework**: Material UI v5
- **Routing**: React Router v6
- **State Management**: React Context API
- **Backend/Database**: Firebase Firestore
- **Authentication**: Firebase Authentication with App Check
- **Storage**: Firebase Storage (for meter photos)
- **Cloud Functions**: Firebase Functions
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- Firebase account with Firestore, Authentication, Storage, and Functions enabled

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd meter-readings-app
```

2. Install dependencies

```bash
npm install
# or
yarn
```

3. Set up Firebase configuration

   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore, Authentication, Functions, and Storage
   - Create a web app in your Firebase project
   - Copy your Firebase config to `src/firebase-config.ts`
   - Set up environment variables in a `.env` file:
     ```
     VITE_FIREBASE_API_KEY=your-api-key
     VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
     VITE_FIREBASE_APP_ID=your-app-id
     VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
     ```

4. Start the development server

```bash
npm run dev
# or
yarn dev
```

## Application Workflow

1. **Login**: Authenticate with your credentials
2. **Route Selection**: Choose a route and billing period (month/year)
3. **Meter Reading**: Navigate through meters, entering readings and validating data
4. **Verification**: Complete additional checks for anomalous readings
5. **Summary Review**: Check all readings before submission
6. **Finalization**: Submit validated data to the central database

## Data Structure

- **Routes**: Collection of meter IDs and addresses for specific geographical areas
- **Readings**: Historical and current readings organized by month and year
- **Validation**: Complex algorithms for detecting unusual consumption patterns
- **Verification**: Additional data collected for anomalous readings

## Build for Production

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

- `src/` - Application source code
  - `assets/` - Static assets
  - `data/` - Local data files for routes and historical readings
  - `services/` - Service modules for Firebase interactions
  - `utils/` - Utility functions for reading validation and calculations
  - `*.tsx` - React components for different screens and UI elements

## License

[Add your license information here]

## Contributors

[Add contributor information here]
