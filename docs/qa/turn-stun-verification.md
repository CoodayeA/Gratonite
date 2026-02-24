# TURN/STUN Verification Checklist (OCI)

Date: 2026-02-22

## Goal

Verify voice/video connectivity for users behind NATs/firewalls during public beta.

## Required Inputs

1. `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` set in API env.
2. Coturn ports open on OCI firewall:
   - `3478/tcp+udp`
   - `5349/tcp` (TLS)

## Verification Steps

1. Join voice channel from two different networks (home + mobile hotspot).
2. Confirm both users connect and hear each other.
3. Enable camera from one user; confirm remote video appears.
4. Start screen share; confirm remote tile updates.
5. Repeat with one browser configured to block direct UDP to force TURN fallback.

## Failure Indicators

1. Users can join but have no media path (silent/black screen).
2. Repeated connect/disconnect loops when camera/share enabled.
3. Voice works only on same LAN but fails across networks.

## Remediation

1. Recheck OCI ingress rules for TURN ports.
2. Confirm coturn credentials match API env.
3. Confirm TLS certificate/SNI setup for TURN TLS endpoint if used.
4. Verify LiveKit and TURN are both reachable from client networks.

