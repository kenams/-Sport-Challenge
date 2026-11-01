import { registerRootComponent } from 'expo';

// La démo hébergée est autonome : aucun chargement de session ou de base locale.
const App = process.env.EXPO_PUBLIC_PREVIEW === 'true'
  ? require('./src/preview/PreviewApp').default
  : require('./App').default;
registerRootComponent(App);
