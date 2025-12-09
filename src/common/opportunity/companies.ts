const SHOWCASE_COMPANIES = [
  {
    name: 'Microsoft',
    favicon: 'https://www.microsoft.com/',
  },
  {
    name: 'Google',
    favicon: 'https://www.google.com/',
  },
  {
    name: 'Apple',
    favicon: 'https://www.apple.com/',
  },
  {
    name: 'IBM',
    favicon: 'https://www.ibm.com/',
  },
  {
    name: 'Oracle',
    favicon: 'https://www.oracle.com/',
  },
  {
    name: 'Salesforce',
    favicon: 'https://www.salesforce.com/',
  },
  {
    name: 'GitHub',
    favicon: 'https://github.com/',
  },
  {
    name: 'Atlassian',
    favicon: 'https://www.atlassian.com/',
  },
  {
    name: 'Cisco',
    favicon: 'https://www.cisco.com/',
  },
  {
    name: 'Intel',
    favicon: 'https://www.intel.com/',
  },
  {
    name: 'AMD',
    favicon: 'https://www.amd.com/',
  },
  {
    name: 'SAP',
    favicon: 'https://www.sap.com/',
  },
  {
    name: 'Vercel',
    favicon: 'https://vercel.com/',
  },
  {
    name: 'Docker',
    favicon: 'https://www.docker.com/',
  },
  {
    name: 'Spotify',
    favicon: 'https://www.spotify.com/',
  },
  {
    name: 'Netflix',
    favicon: 'https://www.netflix.com/',
  },
  {
    name: 'Coinbase',
    favicon: 'https://www.coinbase.com/',
  },
  {
    name: 'Kraken',
    favicon: 'https://www.kraken.com/',
  },
  {
    name: 'Twilio',
    favicon: 'https://www.twilio.com/',
  },
  {
    name: 'Shopify',
    favicon: 'https://www.shopify.com/',
  },
  {
    name: 'Wix',
    favicon: 'https://www.wix.com/',
  },
  {
    name: 'Red Hat',
    favicon: 'https://www.redhat.com/',
  },
  {
    name: 'Tesla',
    favicon: 'https://www.tesla.com/',
  },
  {
    name: 'Square (Block)',
    favicon: 'https://squareup.com/',
  },
  {
    name: 'Ericsson',
    favicon: 'https://www.ericsson.com/',
  },
  {
    name: 'Databricks',
    favicon: 'https://www.databricks.com/',
  },
  {
    name: 'Snowflake',
    favicon: 'https://www.snowflake.com/',
  },
  {
    name: 'Sentry',
    favicon: 'https://sentry.io/',
  },
  {
    name: 'BrowserStack',
    favicon: 'https://www.browserstack.com/',
  },
  {
    name: 'VMware',
    favicon: 'https://www.vmware.com/',
  },
  {
    name: 'Autodesk',
    favicon: 'https://www.autodesk.com/',
  },
  {
    name: 'Huawei',
    favicon: 'https://www.huawei.com/',
  },
  {
    name: 'PwC',
    favicon: 'https://www.pwc.com/',
  },
  {
    name: 'CERN',
    favicon: 'https://home.cern/',
  },
  {
    name: 'NASA',
    favicon: 'https://www.nasa.gov/',
  },
  {
    name: 'Ubisoft',
    favicon: 'https://www.ubisoft.com/',
  },
  {
    name: 'Cognizant',
    favicon: 'https://www.cognizant.com/',
  },
  {
    name: 'Accenture',
    favicon: 'https://www.accenture.com/',
  },
  {
    name: 'TCS',
    favicon: 'https://www.tcs.com/',
  },
  {
    name: 'Wipro',
    favicon: 'https://www.wipro.com/',
  },
  {
    name: 'Infosys',
    favicon: 'https://www.infosys.com/',
  },
  {
    name: 'Capgemini',
    favicon: 'https://www.capgemini.com/',
  },
  {
    name: 'NTT DATA',
    favicon: 'https://www.nttdata.com/',
  },
  {
    name: 'Broadcom',
    favicon: 'https://www.broadcom.com/',
  },
  {
    name: 'Siemens',
    favicon: 'https://www.siemens.com/',
  },
  {
    name: 'Deutsche Bank',
    favicon: 'https://www.db.com/',
  },
  {
    name: 'JPMorgan Chase & Co',
    favicon: 'https://www.jpmorganchase.com/',
  },
  {
    name: 'Capital One',
    favicon: 'https://www.capitalone.com/',
  },
  {
    name: 'Mastercard',
    favicon: 'https://www.mastercard.com/',
  },
  {
    name: 'Vodafone Group',
    favicon: 'https://www.vodafone.com/',
  },
];

export const getShowcaseCompanies = () => {
  const shuffled = [...SHOWCASE_COMPANIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
};
