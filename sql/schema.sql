CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    max_boxes INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mailboxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    subject TEXT,
    received_at INTEGER NOT NULL,
    html_content TEXT,
    text_content TEXT,
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'regular' CHECK (role IN ('regular', 'vip', 'admin')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
