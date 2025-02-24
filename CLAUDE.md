# Water Meter App Guidelines

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `cd functions && npm run serve` - Run Firebase Functions emulator

## Code Style Guidelines
- **Imports**: Group imports by source (React, components, MUI, Firebase)
- **Formatting**: JSX in React components, camelCase for variables/functions
- **Error Handling**: Use try/catch for async operations, console.error for debugging
- **Naming**: PascalCase for components, camelCase for functions/variables
- **State Management**: Use useState/useEffect hooks, store temporary data in localStorage
- **Firebase**: Use the initialized instances from firebase-config.js
- **Components**: Keep components focused on a single responsibility
- **Month Handling**: Use the standardized month arrays for Spanish month names

## Important Notes
- The app uses Firebase for authentication, Firestore, and Cloud Functions
- React Router is used for navigation between screens
- Material UI (MUI) is used for UI components
- When adding features, verify Firebase rules in firestore.rules