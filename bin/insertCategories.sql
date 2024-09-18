INSERT INTO "source_category"
(title, enabled)
VALUES
('Languages', true),
('Web', true),
('Mobile', true),
('Games', true),
('Career', true),
('Fun', true),
('DevTools', true),
('AI', true),
('DevRel', true),
('Open Source', true),
('DevOps & Cloud', true)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    categories TEXT[] := ARRAY['Languages','Web','Mobile','DevOps & Cloud','AI','Games','DevTools','Career','Open Source','DevRel','Fun'];
    i INT;
BEGIN
    -- Iterate over the array and update the table
    FOR i IN 1..array_length(categories, 1) LOOP
        UPDATE source_category
        SET priority = i
        WHERE slug = trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(categories[i],100),''))), '[^a-z0-9-]+', '-', 'gi'));
    END LOOP;
END $$;