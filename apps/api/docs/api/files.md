# Files API

Base path: `/api/v1/files`

---

## POST /upload

Upload a single file. Stored on disk as `uploads/<uuid>.<ext>`. A file record
is inserted into the `files` table and the public URL is returned.

**Auth:** Required

**Content-Type:** `multipart/form-data`

**Form Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The file to upload |

**Limits**

- Maximum file size: **25 MB**

**Response 201**

```json
{
  "id": "uuid",
  "url": "http://localhost:4000/api/v1/files/uuid",
  "filename": "original-filename.png",
  "size": 204800,
  "mimeType": "image/png"
}
```

**Errors**

| Code | Description |
|------|-------------|
| 400 | No file provided or file exceeds 25 MB |
| 401 | Not authenticated |
| 500 | Failed to save file record |

**Example**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/image.png" \
  http://localhost:4000/api/v1/files/upload
```

---

## GET /:fileId

Serve a file by its UUID. The `fileId` is the `id` field returned by `POST /upload`.
This endpoint is public — no authentication required.

**Auth:** None

**Path Parameters**

| Param | Description |
|-------|-------------|
| `fileId` | UUID of the file (from upload response) |

**Response 200** — File binary with correct `Content-Type` header

**Errors**

| Code | Description |
|------|-------------|
| 404 | File record not found in database or missing from disk |
| 500 | Unexpected error serving file |

**Example**

```bash
curl -O http://localhost:4000/api/v1/files/550e8400-e29b-41d4-a716-446655440000
```

---

## Notes

### Storage

Files are stored on the local filesystem at `<project-root>/uploads/<uuid>.<ext>`.
The directory is created automatically on server startup.

### URLs

The public URL is built from the request's own protocol and host:
`${req.protocol}://${req.get('host')}/api/v1/files/<fileId>`

This means the URL works correctly whether the server is running locally or on
a remote host without any environment variable configuration.

### Attachments in Messages

When sending a message with attachments, pass the file `id` values in the
`attachmentIds` array in the message body. The files must have been uploaded
by the same user who is sending the message.

```json
{
  "content": "Check out this screenshot",
  "attachmentIds": ["file-uuid-1"]
}
```

The message response includes a denormalized snapshot of each attachment:

```json
{
  "attachments": [
    {
      "id": "uuid",
      "url": "http://localhost:4000/api/v1/files/uuid",
      "filename": "screenshot.png",
      "size": 204800,
      "mimeType": "image/png"
    }
  ]
}
```
