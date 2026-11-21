// Public settings for the Supabase project (the anon key is designed to be public;
// row level security keeps each household's data private).
export const SUPABASE_URL = 'https://osyhpifmegqotdfdlave.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zeWhwaWZtZWdxb3RkZmRsYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5ODUzNjksImV4cCI6MjExMDU2MTM2OX0.0TuNBUobM0j6cgJQrtiWdTpXoCoiOftxwn_rmfyLPxg';
export const APP_URL = 'https://jscottii.github.io/wfd/';

// ---- Ads & WFD Plus (all off until filled in) ----
// Web ads: your Google AdSense publisher ID (ca-pub-…) and one display ad slot ID.
export const ADSENSE_CLIENT = '';
export const ADSENSE_SLOT = '';
// Phone-app ads (AdMob) are added once you have an AdMob app ID — see the plans doc.
// WFD Plus on the web: a Stripe Payment Link (https://buy.stripe.com/…) and the Stripe customer-portal link for managing it.
export const STRIPE_PAYMENT_LINK = '';
export const STRIPE_PORTAL_LINK = '';
export const PLUS_PRICE = '$2.99/month';

// Amazon Associates tag (e.g. wfd-20). Only with one does the Amazon button fill the cart directly; otherwise it copies the list and opens Amazon Fresh.
export const AMAZON_ASSOCIATE_TAG = '';
