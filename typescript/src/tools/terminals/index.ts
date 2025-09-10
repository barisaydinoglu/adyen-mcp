import { z } from "zod";
import { ScheduleTerminalActionsRequest } from '@adyen/api-library/lib/src/typings/management/scheduleTerminalActionsRequest';
import { TerminalSettings } from '@adyen/api-library/lib/src/typings/management/terminalSettings';
import * as constants from "./constants"; // Group constants under a namespace
import * as schemas from "./schemas";
import { createTool } from "./toolFactory";

// =================================================================
//  Tool Definitions
// =================================================================

const createTerminalActionTool = createTool({
  name: constants.CREATE_TERMINAL_ACTION_NAME,
  description: constants.CREATE_TERMINAL_ACTION_DESCRIPTION,
  schema: {
    ...schemas.scheduleTerminalActionsRequestSchema.shape,
  },
  apiCall: (api, args) => api.TerminalActionsTerminalLevelApi.createTerminalAction(args as ScheduleTerminalActionsRequest),
});

const getAndroidAppTool = createTool({
  name: constants.GET_ANDROID_APP_NAME,
  description: constants.GET_ANDROID_APP_DESCRIPTION,
  schema: {
    id: z.string(),
    companyId: z.string(),
  },
  apiCall: (api, args) => api.AndroidFilesCompanyLevelApi.getAndroidApp(args.companyId, args.id),
});

const listAndroidAppsTool = createTool({
  name: constants.LIST_ANDROID_APPS_NAME,
  description: constants.LIST_ANDROID_APPS_DESCRIPTION,
  schema: {
    companyId: z.string(),
    packageName: z.string().optional(),
    versionCode: z.number().optional(),
    pageNumber: z.number().optional(),
    pageSize: z.number().optional(),
  },
  apiCall: (api, args) => api.AndroidFilesCompanyLevelApi.listAndroidApps(args.companyId, args.pageNumber, args.pageSize, args.packageName, args.versionCode),
});

const listAndroidCertificatesTool = createTool({
  name: constants.LIST_ANDROID_CERTIFICATES_NAME,
  description: constants.LIST_ANDROID_CERTIFICATES_DESCRIPTION,
  schema: {
    companyId: z.string(),
    certificateName: z.string().optional(),
    pageNumber: z.number().optional(),
    pageSize: z.number().optional(),
  },
  apiCall: (api, args) => api.AndroidFilesCompanyLevelApi.listAndroidCertificates(args.companyId, args.pageNumber, args.pageSize, args.certificateName),
});

const listTerminalsTool = createTool({
  name: constants.LIST_TERMINALS_NAME,
  description: constants.LIST_TERMINALS_DESCRIPTION,
  schema: {
    searchQuery: z.string().optional(),
    otpQuery: z.string().optional(),
    countries: z.string().optional(),
    merchantIds: z.string().optional(),
    storeIds: z.string().optional(),
    brandModels: z.string().optional(),
    pageNumber: z.number().optional(),
    pageSize: z.number().optional(),
  },
  apiCall: (api, args) => api.TerminalsTerminalLevelApi.listTerminals(args.searchQuery, args.otpQuery, args.countries, args.merchantIds, args.storeIds, args.brandModels, args.pageNumber, args.pageSize),
});

const listTerminalActionsTool = createTool({
  name: constants.LIST_TERMINAL_ACTIONS_NAME,
  description: constants.LIST_TERMINAL_ACTIONS_DESCRIPTION,
  schema: {
    companyId: z.string(),
    type: z.string().optional(),
    status: z.string().optional(),
    pageNumber: z.number().optional(),
    pageSize: z.number().optional(),
  },
  apiCall: (api, args) => api.TerminalActionsCompanyLevelApi.listTerminalActions(args.companyId, args.pageNumber, args.pageSize, args.status, args.type),
});

const reassignTerminalTool = createTool({
  name: constants.REASSIGN_TERMINAL_NAME,
  description: constants.REASSIGN_TERMINAL_DESCRIPTION,
  schema: {
    terminalId: z.string(),
    companyId: z.string().optional(),
    merchantId: z.string().optional(),
    storeId: z.string().optional(),
    inventory: z.boolean().optional(),
  },
  apiCall: (api, { terminalId, ...reassignData }) => api.TerminalsTerminalLevelApi.reassignTerminal(terminalId, reassignData),
  successMessage: (_, args) => `Terminal ${args.terminalId} reassignment initiated successfully.`,
});

// =================================================================
//  Specialized Factory for Terminal Settings Subtools
// =================================================================

type SettingsLevel = 'company' | 'merchant' | 'store' | 'terminal';
type SettingsSectionConfig = {
  key: keyof typeof schemas.terminalSettingsSchema.shape;
  schema: z.ZodTypeAny;
  humanReadableName: string;
  exampleObject: object;
};

/**
 * Creates a pair of GET and UPDATE tools for a specific section of terminal settings
 * at a specific account level (company, merchant, etc.).
 */
function createTerminalSettingsSubTools(level: SettingsLevel, sectionConfig: SettingsSectionConfig) {
  const { key, schema, humanReadableName, exampleObject } = sectionConfig;
  const capitalizedLevel = level.charAt(0).toUpperCase() + level.slice(1);
  const apiService = `TerminalSettings${capitalizedLevel}LevelApi`;
  const idName = `${level}Id`;
  
  // Dynamically create the GET description from the template
  const getToolDescription = constants.GET_TERMINAL_SETTINGS_SUBTOOL_DESCRIPTION_TEMPLATE
    .replace(/{{SETTING_NAME}}/g, humanReadableName)
    .replace(/{{LEVEL}}/g, level)
    .replace(/{{ID_NAME}}/g, idName);

  // Dynamically create the UPDATE description from the template
  const updateToolDescription = constants.UPDATE_TERMINAL_SETTINGS_SUBTOOL_DESCRIPTION_TEMPLATE
    .replace(/{{SETTING_NAME}}/g, humanReadableName)
    .replace(/{{SETTING_KEY}}/g, key)
    .replace(/{{LEVEL}}/g, level)
    .replace(/{{ID_NAME}}/g, idName)
    .replace(/{{EXAMPLE_OBJECT}}/g, JSON.stringify(exampleObject, null, 4).replace(/\n/g, '\n        '));

  // --- GET Subtool ---
  const getTool = createTool({
    name: `get_terminal_settings_${key}_${level}_level`,
    description: getToolDescription,
    schema: { [idName]: z.string().describe(`The unique identifier of the ${level}.`) },
    apiCall: async (api, args) => {
      const service = (api as any)[apiService];
      const getMethod = level === 'store' ? 'getTerminalSettingsByStoreId' : 'getTerminalSettings';
      const fullSettings = await service[getMethod](args[idName]);
      return fullSettings?.[key] ?? `No '${key}' settings found for this ${level}.`;
    },
  });

  // --- UPDATE Subtool ---
  const updateTool = createTool({
    name: `update_terminal_settings_${key}_${level}_level`,
    description: updateToolDescription,
    schema: {
      [idName]: z.string().describe(`The unique identifier of the ${level}.`),
      settings: schema.describe(`The ${key} settings object to apply.`),
    },
    apiCall: (api, args) => {
      const service = (api as any)[apiService];
      const updateMethod = level === 'store' ? 'updateTerminalSettingsByStoreId' : 'updateTerminalSettings';
      const settingsBody = { [key]: args.settings };
      return service[updateMethod](args[idName], settingsBody as TerminalSettings);
    },
  });

  return [getTool, updateTool];
}

// =================================================================
//  Configuration for Generating Subtools
// =================================================================

const settingsSections: SettingsSectionConfig[] = [
    { key: 'cardholderReceipt', schema: schemas.cardholderReceiptSchema, humanReadableName: 'Cardholder Receipt', exampleObject: { "headerForAuthorizedReceipt": "Thank You!" } },
    { key: 'connectivity', schema: schemas.connectivitySchema, humanReadableName: 'Connectivity', exampleObject: { "simcardStatus": "ACTIVATED" } },
    { key: 'gratuities', schema: z.array(schemas.gratuitySchema), humanReadableName: 'Gratuities', exampleObject: [{ "currency": "USD", "usePredefinedTipEntries": true, "predefinedTipEntries": ["5%", "10%"] }] },
    { key: 'hardware', schema: schemas.hardwareSchema, humanReadableName: 'Hardware', exampleObject: { "restartHour": 5, "displayMaximumBackLight": 90 } },
    { key: 'localization', schema: schemas.localizationSchema, humanReadableName: 'Localization', exampleObject: { "language": "en-US", "timezone": "America/New_York" } },
    { key: 'nexo', schema: schemas.nexoSchema, humanReadableName: 'Nexo', exampleObject: { "notification": { "enabled": true, "category": "SaleWakeUp" } } },
    { key: 'offlineProcessing', schema: schemas.offlineProcessingSchema, humanReadableName: 'Offline Processing', exampleObject: { "chipFloorLimit": 5000 } },
    { key: 'opi', schema: schemas.opiSchema, humanReadableName: 'OPI', exampleObject: { "enablePayAtTable": true } },
    { key: 'passcodes', schema: schemas.passcodesSchema, humanReadableName: 'Passcodes', exampleObject: { "adminMenuPin": "9876", "txMenuPin": "1234" } },
    { key: 'payAtTable', schema: schemas.payAtTableSchema, humanReadableName: 'Pay at Table', exampleObject: { "enablePayAtTable": true, "authenticationMethod": "MAGSWIPE" } },
    { key: 'payment', schema: schemas.paymentSchema, humanReadableName: 'Payment', exampleObject: { "contactlessCurrency": "USD" } },
    { key: 'receiptOptions', schema: schemas.receiptOptionsSchema, humanReadableName: 'Receipt Options', exampleObject: { "promptBeforePrinting": true } },
    { key: 'receiptPrinting', schema: schemas.receiptPrintingSchema, humanReadableName: 'Receipt Printing', exampleObject: { "shopperApproved": true, "shopperRefused": false } },
    { key: 'refunds', schema: schemas.refundsSchema, humanReadableName: 'Refunds', exampleObject: { "referenced": { "enableStandaloneRefunds": true } } },
    { key: 'signature', schema: schemas.signatureSchema, humanReadableName: 'Signature', exampleObject: { "skipSignature": true } },
    { key: 'standalone', schema: schemas.standaloneSchema, humanReadableName: 'Standalone', exampleObject: { "enableStandalone": true, "currencyCode": "USD" } },
    { key: 'storeAndForward', schema: schemas.storeAndForwardSchema, humanReadableName: 'Store and Forward', exampleObject: { "maxPayments": 50, "maxAmount": [{ "currencyCode": "USD", "amount": 10000 }] } },
    { key: 'surcharge', schema: schemas.surchargeSchema, humanReadableName: 'Surcharge', exampleObject: { "askConfirmation": true } },
    { key: 'tapToPay', schema: schemas.tapToPaySchema, humanReadableName: 'Tap to Pay', exampleObject: { "merchantDisplayName": "My Awesome Store" } },
    { key: 'terminalInstructions', schema: schemas.terminalInstructionsSchema, humanReadableName: 'Terminal Instructions', exampleObject: { "adyenAppRestart": true } },
    { key: 'timeouts', schema: schemas.timeoutsSchema, humanReadableName: 'Timeouts', exampleObject: { "fromActiveToSleep": 180 } },
    { key: 'wifiProfiles', schema: schemas.wifiProfilesSchema, humanReadableName: 'Wi-Fi Profiles', exampleObject: { "profiles": [{ "ssid": "YourNetworkSSID", "authType": "wpa-psk", "psk": "your_password" }] } },
];

// =================================================================
//  Dynamic Tool Generation
// =================================================================

const allSettingsSubTools = settingsSections.flatMap((sectionConfig) => [
  ...createTerminalSettingsSubTools('company', sectionConfig),
  ...createTerminalSettingsSubTools('merchant', sectionConfig),
  ...createTerminalSettingsSubTools('store', sectionConfig),
  ...createTerminalSettingsSubTools('terminal', sectionConfig),
]);

// =================================================================
//  Existing and Generated Tool Exports
// =================================================================

export const terminalTools = [
  createTerminalActionTool,
  getAndroidAppTool,
  listAndroidAppsTool,
  listAndroidCertificatesTool,
  listTerminalsTool,
  listTerminalActionsTool,
  reassignTerminalTool,
  ...allSettingsSubTools,
];