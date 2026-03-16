"""Events router."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from pydantic import BaseModel

from app.core.database import get_db, Base
from app.models.user import User
from .auth import require_auth


# Event model
class Event(Base):
    """Event model for conferences, roadshows, and networking events."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(String(100), default="conference")  # conference, roadshow, networking, webinar
    location = Column(String(255))
    virtual_link = Column(String(500))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    organizer_id = Column(Integer, ForeignKey("users.id"))
    max_attendees = Column(Integer)
    is_public = Column(Boolean, default=True)
    status = Column(String(50), default="upcoming")  # upcoming, ongoing, completed, cancelled
    tags = Column(Text)  # JSON array as string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Pydantic schemas
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = "conference"
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_attendees: Optional[int] = None
    is_public: Optional[bool] = True
    tags: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_attendees: Optional[int] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None
    tags: Optional[str] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    location: Optional[str] = None
    virtual_link: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    organizer_id: Optional[int] = None
    max_attendees: Optional[int] = None
    is_public: bool = True
    status: str = "upcoming"
    tags: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


router = APIRouter(prefix="/events", tags=["Events"])


@router.get("/", response_model=List[EventResponse])
def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """List all events."""
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if status:
        query = query.filter(Event.status == status)
    return query.order_by(Event.start_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new event."""
    event = Event(
        title=event_data.title,
        description=event_data.description,
        event_type=event_data.event_type,
        location=event_data.location,
        virtual_link=event_data.virtual_link,
        start_date=event_data.start_date,
        end_date=event_data.end_date,
        organizer_id=current_user.id,
        max_attendees=event_data.max_attendees,
        is_public=event_data.is_public,
        tags=event_data.tags,
        status="upcoming",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get a specific event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update an event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    for field, value in event_data.dict(exclude_unset=True).items():
        setattr(event, field, value)
    event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete an event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.organizer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    db.delete(event)
    db.commit()
