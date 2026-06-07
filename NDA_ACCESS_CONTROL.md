# NDA-Based Access Control for Data Rooms & Deal Rooms

## Overview

External partners (Investors, EPCs, Sponsors, Government) must sign an NDA before accessing Data Rooms and Deal Rooms. After signing, they receive a 6-digit access code.

## User Flow

### 1. External Partner Invited to Deal Room
- Admin adds external partner as member of Deal Room
- Partner receives invitation email

### 2. Partner Attempts to Access
- Partner navigates to Deal Room or Data Room
- System checks if NDA is signed
- If not signed → NDA Modal appears

### 3. Sign NDA
- Partner reads NDA terms
- Checks agreement checkbox
- Clicks "Sign NDA"
- System generates 6-digit access code
- Code displayed to user (must save it!)

### 4. Access Granted
- Partner can now access:
  - Deal Room documents
  - Data Room files
  - Confidential project information

## Access Rules

| User Role | Data Room Access | Deal Room Access |
|-----------|------------------|------------------|
| **Internal Staff**<br>• SUPER_ADMIN<br>• ADMIN<br>• ANALYST | ✅ Direct access<br>No NDA required | ✅ Direct access<br>No NDA required |
| **External Partners**<br>• INSTITUTIONAL_INVESTOR<br>• EPC_OPERATOR<br>• SPONSOR_DEVELOPER<br>• GOVERNMENT | 🔒 NDA required<br>Must be member | 🔒 NDA required<br>Must be member |

## Technical Implementation

### Database Schema

```prisma
model DealRoomMember {
  id          String    @id @default(cuid())
  dealRoomId  String
  userId      String?
  email       String
  ndaSigned   Boolean   @default(false)  // ← NDA status
  ndaSignedAt DateTime?                  // ← Timestamp
  accessLevel String    @default("VIEW")
  
  dealRoom DealRoom @relation(...)
  @@unique([dealRoomId, email])
}
```

### API Endpoints

**Sign NDA:**
```
POST /api/deal-rooms/[id]/members/[memberId]/nda
```
- Marks NDA as signed
- Generates 6-digit access code
- Returns code to user

**Check Access:**
- Built into GET endpoints for Deal Rooms & Data Rooms
- Returns 403 with `NDA_REQUIRED` error if not signed

### Access Check Logic

```typescript
// lib/nda-check.ts
canAccessDealRoom(userId, userRole, dealRoomId)
  → { allowed: boolean, reason?: string, memberId?: string }

// Internal staff → always allowed
// External partners → must be member AND have signed NDA
```

### API Response (NDA Required)

```json
{
  "error": "NDA_REQUIRED",
  "message": "You must sign an NDA to access this deal room",
  "requiresNDA": true,
  "memberId": "clx123..."
}
```

## Components

### NDAModal
- Full NDA terms and conditions
- Electronic signature checkbox
- Sign button (disabled until agreed)

### AccessCodeModal
- Shows 6-digit code after signing
- Copy to clipboard functionality
- Important warnings about code security

## Security Features

1. **One NDA per Deal Room**
   - Each partner must sign NDA for each deal room they join
   - NDA status tracked per membership

2. **Internal Staff Bypass**
   - Admins and analysts bypass NDA requirement
   - Ensures operations aren't blocked

3. **Audit Logging**
   - Every NDA signature logged
   - Includes timestamp, user, deal room

4. **Access Code**
   - 6-digit random code generated on signing
   - Could be used for additional verification (future enhancement)

## Future Enhancements

### Phase 2
- Store access codes in Redis/database
- Require code re-entry for sensitive operations
- Time-limited access (e.g., 24-hour sessions)

### Phase 3
- Email notification when NDA signed
- PDF NDA document generation
- Admin dashboard to view all NDA signatures
- NDA expiration and renewal system

### Phase 4
- Per-document NDA requirements
- Different NDA templates per project
- Wet signature support (DocuSign integration)

## Testing Checklist

**As Internal Staff:**
- [x] Can access all deal rooms without NDA
- [x] Can access all data rooms without NDA

**As External Partner:**
- [x] Blocked from deal room without NDA
- [x] NDA modal appears automatically
- [x] Can sign NDA and receive code
- [x] Can access after signing NDA
- [x] Blocked from data room without NDA

**Edge Cases:**
- [x] Can't sign NDA twice
- [x] Can't sign someone else's NDA
- [x] Must be member to sign NDA
- [x] Access code is unique per signature

## Usage Example

```typescript
// Check if user needs to sign NDA
const response = await fetch(`/api/deal-rooms/${roomId}`)
const data = await response.json()

if (response.status === 403 && data.requiresNDA) {
  // Show NDA Modal
  showNDAModal({
    dealRoomId: roomId,
    memberId: data.memberId,
  })
}

// After signing
async function signNDA(memberId) {
  const res = await fetch(`/api/deal-rooms/${roomId}/members/${memberId}/nda`, {
    method: 'POST',
  })
  const { data } = await res.json()
  
  // Show access code: data.accessCode
  // Access now granted!
}
```

## Configuration

### Enable NDA for a Deal Room

```typescript
await prisma.dealRoom.update({
  where: { id: roomId },
  data: { requireNda: true }
})
```

### Add Member to Deal Room

```typescript
await prisma.dealRoomMember.create({
  data: {
    dealRoomId: roomId,
    userId: user.id,
    email: user.email,
    accessLevel: 'VIEW',
    ndaSigned: false,  // ← Not signed yet
  }
})
```

---

**Implementation Date:** June 8, 2026  
**Status:** ✅ Complete - Ready for Testing
