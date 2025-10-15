-- PART DE PUBLICACIONS

CREATE TYPE state_type AS ENUM ('Completed', 'Cancelled', 'Pending');

-- Publication (Classe base)
CREATE TABLE publication (
    publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    publication_state state_type NOT NULL
);

-- Reward (Subclasse de Publication)
CREATE TABLE reward (
    publication_id UUID PRIMARY KEY REFERENCES publication(publication_id),
    content TEXT NOT NULL,
    points_price INTEGER NOT NULL
);

CREATE TYPE item_state_type AS ENUM ('New', 'Little used', 'Widely used', 'Bad condition');

-- ObjectTrade (Subclasse de Publication)
CREATE TABLE object_trade (
    publication_id UUID PRIMARY KEY REFERENCES publication(publication_id),
    item_state item_state_type NOT NULL,
    points_price INTEGER
);





-- PART D'USUARIS

CREATE TYPE app_language_type AS ENUM ('Catalan', 'Spanish', 'English');

-- User (Classe base)
CREATE TABLE "user" (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- RegisteredUser (Subclasse de User)
CREATE TABLE registered_user (
    user_id UUID PRIMARY KEY REFERENCES "user"(user_id),
    name TEXT NOT NULL,
    surname TEXT,
    dni TEXT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    app_language app_language_type NOT NULL
);

-- Client (Subclasse de RegisteredUser)
CREATE TABLE client (
    user_id UUID PRIMARY KEY REFERENCES registered_user(user_id),
    address TEXT,
    phone INTEGER,
    points INTEGER,
    birth_date DATE,
    description TEXT,
    profile_picture TEXT,
    streak INTEGER
);

-- Admin (Subclasse de RegisteredUser)
CREATE TABLE admin (
    user_id UUID PRIMARY KEY REFERENCES registered_user(user_id)
    -- Sense camps específics per ara
);

-- Institution (Subclasse de RegisteredUser)
CREATE TABLE institution (
    user_id UUID PRIMARY KEY REFERENCES registered_user(user_id)
    -- Sense camps específics per ara
);






-- PART DE NOTIFICACIONS

CREATE TYPE notification_type AS ENUM (
    'CollectionServices',
    'ContainerStates',
    'RecyclingEvents',
    'NewRewards',
    'NewTrade',
    'NewMessage',
    'Incidences'
);

CREATE TABLE notification (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES registered_user(user_id),
    notification_type notification_type NOT NULL,
    content TEXT NOT NULL,
    delivered BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índex per consultes ràpides per no lliurades
CREATE INDEX idx_notification_undelivered ON notification (delivered) WHERE delivered = FALSE;








-- PART DE MISSATGES

CREATE TABLE media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES message(message_id),
    media_url TEXT NOT NULL
);

CREATE TABLE message (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sender_id UUID NOT NULL REFERENCES client(user_id),
    receiver_id UUID NOT NULL REFERENCES client(user_id),
    CONSTRAINT chk_sender_receiver CHECK (sender_id <> receiver_id)
);
