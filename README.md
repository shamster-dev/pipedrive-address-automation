A Next JS automation service that listens to dispatched PipeDrive WebHooks, processes the data into house information via relevant APIs and posts the information back to PipeDrive to autofill house information from an address field within a deal on the pipeline.

---

## Features
- **Webhook Listener**: Securely handles incoming POST requests from Pipedrive.
- **Data Enrichment**: Takes raw address inputs and queries property data APIs.
- **Auto-Update**: Automatically writes the processed house details back into Pipedrive fields.
- **Next.js API Routes**: Built using Next.js serverless/API architecture for easy deployment.

---

## Env

```env
PORT=3000
PIPEDRIVE_API_TOKEN=your_pipedrive_api_token_here
PIPEDRIVE_COMPANY_DOMAIN=your_company_domain
PROPERTY_API_KEY=your_property_data_api_key_here
