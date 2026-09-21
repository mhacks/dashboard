-- Local demo only. Production migrations do not publish sample event content.
INSERT INTO "public"."events" (
  "id",
  "slug",
  "name",
  "description",
  "location",
  "starts_at",
  "ends_at",
  "is_active"
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'check-in',
    'Check-in Opens',
    'Pick up your badge and get settled before opening ceremony.',
    'Michigan Union',
    '2026-10-03T09:00:00-04:00',
    '2026-10-03T11:00:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'opening-ceremony',
    'Opening Ceremony',
    'Meet the team, hear the rules, and get ready for the weekend.',
    'Rackham Auditorium',
    '2026-10-03T11:30:00-04:00',
    '2026-10-03T12:15:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'hacking-begins',
    'Hacking Begins',
    'Find a table, sync with your team, and start building.',
    'Hack Floor',
    '2026-10-03T12:30:00-04:00',
    NULL,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'rapid-prototyping',
    'Intro to Rapid Prototyping',
    'Turn a rough idea into a product direction your team can demo.',
    'Workshop Room A',
    '2026-10-03T14:00:00-04:00',
    '2026-10-03T14:45:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'dinner',
    'Dinner',
    'Dinner service for hackers, mentors, volunteers, and sponsors.',
    'Dining Hall',
    '2026-10-03T18:30:00-04:00',
    '2026-10-03T20:00:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'midnight-surprise',
    'Midnight Surprise',
    'Take a quick break for snacks and a mini-challenge.',
    'Main Stage',
    '2026-10-04T00:00:00-04:00',
    '2026-10-04T00:30:00-04:00',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'submissions-due',
    'Project Submissions Due',
    'Submit your project, demo link, team, and prize tracks before the deadline.',
    'Devpost',
    '2026-10-04T12:30:00-04:00',
    NULL,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    'expo-and-judging',
    'Expo and Judging',
    'Present your project to judges and explore what other teams built.',
    'Expo Floor',
    '2026-10-04T13:30:00-04:00',
    '2026-10-04T15:30:00-04:00',
    false
  )
ON CONFLICT ("slug") DO NOTHING;
INSERT INTO "public"."live_event_details" (
  "event_id",
  "description",
  "location_details",
  "map_url",
  "event_type",
  "host_name",
  "audience",
  "featured",
  "status",
  "position"
)
SELECT
  "events"."id",
  "seed"."description",
  "seed"."location_details",
  "seed"."map_url",
  "seed"."event_type",
  "seed"."host_name",
  "seed"."audience",
  "seed"."featured",
  'published'::"public"."live_content_status",
  "seed"."position"
FROM (
  VALUES
    ('check-in', 'Bring a photo ID and have your registration email ready. Organizers can help with team and registration questions at the check-in desk.', 'Enter through the main State Street doors and follow signs to the check-in desks.', 'https://maps.google.com/?q=Michigan+Union+Ann+Arbor', 'Logistics', 'MHacks Operations', 'All hackers', true, 0),
    ('opening-ceremony', 'The opening program covers venue logistics, judging, prize tracks, safety, and where to get support. Sponsor representatives will also introduce the challenges available to hackers.', 'Doors open 20 minutes before the program. Accessible seating is available through the main lobby.', 'https://maps.google.com/?q=Rackham+Auditorium+Ann+Arbor', 'Main Event', 'MHacks', 'Hackers, mentors, volunteers, and sponsors', true, 10),
    ('hacking-begins', 'Hacking officially begins. Mentors will start circulating shortly afterward, and organizer support remains available at the help desk throughout the event.', 'Table assignments and quiet work areas will be posted at the venue.', NULL, 'Main Event', 'MHacks', 'All hackers', true, 20),
    ('rapid-prototyping', 'This hands-on workshop moves from problem framing through a lightweight prototype. Bring a laptop and an idea, or join a group when the session starts.', 'Arrive a few minutes early for seating and setup.', NULL, 'Workshop', 'MHacks Tech', 'Beginners welcome', false, 30),
    ('dinner', 'Bring your badge when entering the dining area. Dietary labels will be posted with each option, and organizers can help with allergy questions.', 'Food is served in waves; check announcements for any line or service updates.', NULL, 'Food', 'MHacks Logistics', 'Registered attendees', false, 40),
    ('midnight-surprise', 'Step away from your project for a short reset with food and an optional activity. Full details will be announced during the event.', 'Listen for the announcement before midnight.', NULL, 'Activity', 'MHacks Logistics', 'All attendees', false, 50),
    ('submissions-due', 'Open your Devpost submission early enough to verify every team member, track selection, repository link, and demo asset. Late edits may not be available once judging begins.', 'Submission happens online. The help desk can assist with submission issues before the deadline.', NULL, 'Deadline', 'MHacks', 'Competing teams', true, 60),
    ('expo-and-judging', 'Teams should be ready to give a concise project explanation and a working demo. Keep at least one team member near the assigned table throughout the judging window.', 'Table assignments and judging waves will be posted before hacking ends.', NULL, 'Main Event', 'MHacks Judging', 'Hackers, judges, mentors, and sponsors', true, 70)
) AS "seed" (
  "slug",
  "description",
  "location_details",
  "map_url",
  "event_type",
  "host_name",
  "audience",
  "featured",
  "position"
)
JOIN "public"."events" ON "events"."slug" = "seed"."slug"
  AND "events"."id"::text LIKE '10000000-0000-4000-8000-%'
ON CONFLICT ("event_id") DO NOTHING;
INSERT INTO "public"."live_event_resources" (
  "event_id",
  "kind",
  "label",
  "url",
  "position"
)
SELECT
  "events"."id",
  "seed"."kind"::"public"."live_event_resource_kind",
  "seed"."label",
  NULL,
  0
FROM (
  VALUES
    ('rapid-prototyping', 'workshop', 'Workshop materials'),
    ('submissions-due', 'devpost', 'Open Devpost')
) AS "seed" ("slug", "kind", "label")
JOIN "public"."events" ON "events"."slug" = "seed"."slug"
  AND "events"."id"::text LIKE '10000000-0000-4000-8000-%'
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."live_event_resources" AS "existing"
  WHERE "existing"."event_id" = "events"."id"
    AND "existing"."kind"::text = "seed"."kind"
    AND "existing"."label" = "seed"."label"
);
INSERT INTO "public"."live_announcements" (
  "id",
  "title",
  "body",
  "tone",
  "status",
  "published_at",
  "position"
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Sample announcement',
  'Important event updates, schedule changes, and attendee reminders will appear here during the hackathon.',
  'info',
  'published',
  NULL,
  0
)
ON CONFLICT ("id") DO NOTHING;
