import { createLogger } from '#lib/logger.js';

const log = createLogger('job:keep-alive-ai');
const AI_SERVICE_URL = 'https://tacosrra-ecomap-ai.hf.space/bikes';

/**
 * Pings the AI service to prevent it from sleeping (Hugging Face Spaces sleep after 48h of inactivity).
 */
export async function runKeepAliveJob() {
  try {
    log.info(`Pinging AI service at ${AI_SERVICE_URL}...`);
    const response = await fetch(AI_SERVICE_URL);

    if (response.ok) {
      log.info(`AI service ping successful: ${response.status}`);
    } else {
      log.warn(`AI service ping returned status: ${response.status}`);
    }
  } catch (error) {
    log.error('Error pinging AI service:', error);
  }
}
