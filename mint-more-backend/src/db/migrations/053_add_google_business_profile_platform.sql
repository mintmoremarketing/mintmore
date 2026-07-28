-- Add 'google_business_profile' to the social_platform enum type if it does not exist
ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'google_business_profile';
