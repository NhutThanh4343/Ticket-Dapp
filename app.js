import { walletService, ticketService } from './src/index.js';
import { readFrontendSettings } from './src/config/frontend.js';
import { createCustomerApp } from './src/ui/customerApp.js';
import { mountAdminPreview } from './src/ui/adminPreview.js';

const settings = readFrontendSettings();
if (settings.error) console.warn('TourChain configuration:', settings.error.message);

const app = createCustomerApp({ document, wallet: walletService, tickets: ticketService, settings });
const adminPreview = mountAdminPreview(document);
void app.start();

if (import.meta.hot) import.meta.hot.dispose(() => { app.destroy(); adminPreview.destroy(); });
