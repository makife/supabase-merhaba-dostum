-- Add effect settings to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS effects_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS confetti_effect_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS fireworks_effect_enabled BOOLEAN DEFAULT true;