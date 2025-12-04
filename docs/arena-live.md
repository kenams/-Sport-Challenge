# Arena Live - Architecture & Modèle de Données

## Tables Supabase

```sql
create table public.arena_rooms (
  id uuid primary key default gen_random_uuid(),
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','live','finished','canceled')),
  stake integer not null default 0,
  level_required integer not null default 5,
  created_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  ended_at timestamptz
);

create table public.arena_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  round_number integer not null,
  repetitions integer not null,
  status text not null default 'pending' check (status in ('pending','running','validated','failed')),
  deadline timestamptz,
  winner_id uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.arena_signals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.arena_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target text not null check (target in ('host','guest','all')),
  type text not null check (type in ('offer','answer','candidate','data')),
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);
```

### Indexes conseillés

```sql
create index on public.arena_rooms (challenge_id);
create index on public.arena_rooms (status);
create index on public.arena_rounds (room_id, round_number);
create index on public.arena_signals (room_id, created_at);
```

### Triggers (pseudo‑code)

- `arena_rooms_before_update`: empêcher un passage de `finished` à un autre statut.
- `arena_rounds_validate`: lorsque `status = 'validated'`, incrémenter les points + libérer la stake sur le gagnant.
- `arena_rooms_finalize`: lorsqu’une room est `finished`, créer une entrée dans `activities` + déclencher la punition si l’host abandonne.

## Signalisation WebRTC

1. **createRoom** (POST `/arena/rooms`): vérifie niveau, punition, mise → crée `arena_rooms`.
2. **joinRoom** (POST `/arena/rooms/{id}/join`): vérifie disponibilité + niveau.
3. **offer / answer / candidate**: endpoints REST ou WebSocket (ex: `/arena/rooms/{id}/signal`) qui stockent les payloads dans `arena_signals` et notifient l’autre joueur (Supabase Realtime ou WebSocket natif).

Security: tous les endpoints valident le JWT Supabase (`Authorization: Bearer`).  
Cleanup: CRON pour supprimer les rooms `waiting` depuis >15 min.

## Streams Vidéo

- **Option SFU** : LiveKit Cloud / Agora (recommandé pour la stabilité).
- **Option P2P** : WebRTC direct via `react-native-webrtc` + STUN/TURN (moins robuste).

Pour la V1, l’app se connecte au signal server, ouvre un `PeerConnection`, et expose un `dataChannel` pour la pyramide (rounds, timers).

## Étapes suivantes

1. Implémenter les functions HTTP (Edge Functions Supabase ou service dédié).
2. Connecter `ArenaLiveScreen` aux endpoints (création de room, join, polling, data channel).
3. Ajouter un monitoring (logs + table `arena_reports`).
