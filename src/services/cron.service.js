import cron from 'node-cron';
import { importNavarraRecyclingPoints } from './navarra.service';

//Programa el cron cada dia a les 03:00 del matí
cron.schedule('0 3 * * *', async () => {
  console.log('🕒 Executant actualització automàtica de punts de reciclatge (Navarra)...');
  await importNavarraRecyclingPoints();
});

console.log('✅ Cron diari de Navarra inicialitzat');
