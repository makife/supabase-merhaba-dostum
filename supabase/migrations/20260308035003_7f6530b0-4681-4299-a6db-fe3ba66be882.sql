
DELETE FROM challenge_scores 
WHERE user_id = '7fe7b3a0-eea7-4379-8011-ae7409008664' 
AND date = CURRENT_DATE 
AND challenge_type IN ('puzzle', 'memory')
AND score = 0;
