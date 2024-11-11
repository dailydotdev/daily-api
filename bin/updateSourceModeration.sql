DO $$
BEGIN
    UPDATE  source

    SET     "requireModeration" = true

    WHERE   type = 'squad'
    AND     "requireModeration" != true
    AND     private IS FALSE;
END $$;
