import { walletService, ticketService } from './src/index.js';
import { readFrontendSettings } from './src/config/frontend.js';
import { createCustomerApp } from './src/ui/customerApp.js';

const settings = readFrontendSettings();
if (settings.error) console.warn('TourChain configuration:', settings.error.message);

const app = createCustomerApp({ document, wallet: walletService, tickets: ticketService, settings });
void app.start();

if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
