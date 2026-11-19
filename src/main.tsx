import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import 'flag-icons/css/flag-icons.min.css';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
