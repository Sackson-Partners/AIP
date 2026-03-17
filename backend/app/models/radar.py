"""Africa Infrastructure Radar models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class RadarEntry(Base):
    """Represents a tracked infrastructure project on the Africa Radar."""
        __tablename__ = "radar_entries"

            id = Column(Integer, primary_key=True, autoincrement=True)
                uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

                    # Project reference (optional link to formal project)
                        project_id = Column(Integer, ForeignKey("aip_projects.id", ondelete="SET NULL"), nullable=True)

                            # Identification
                                name = Column(String(255), nullable=False)
                                    country = Column(String(100), nullable=False)
                                        sector = Column(String(100), nullable=False)
                                            sub_sector = Column(String(100), nullable=True)
                                                region = Column(String(100), nullable=True)

                                                    # Status & Stage
                                                        status = Column(String(50), default="tracking", nullable=False)
                                                            # tracking, active, stalled, completed, cancelled
                                                                stage = Column(String(50), nullable=True)
                                                                    # pre-feasibility, feasibility, construction, operation

                                                                        # Financial
                                                                            estimated_value_usd = Column(Numeric(18, 2), nullable=True)
                                                                                funding_gap_usd = Column(Numeric(18, 2), nullable=True)
                                                                                    funding_sources = Column(String(500), nullable=True)  # Comma-separated

                                                                                        # Intelligence
                                                                                            risk_score = Column(Integer, nullable=True)  # 0-100
                                                                                                opportunity_score = Column(Integer, nullable=True)  # 0-100
                                                                                                    esg_score = Column(Integer, nullable=True)  # 0-100
                                                                                                        tags = Column(String(500), nullable=True)  # Comma-separated tags
                                                                                                            notes = Column(Text, nullable=True)
                                                                                                                data_sources = Column(JSON, nullable=True)  # Source URLs / citations
                                                                                                                
                                                                                                                    # Tracking metadata
                                                                                                                        last_update_source = Column(String(255), nullable=True)
                                                                                                                            is_featured = Column(Boolean, default=False, nullable=False)
                                                                                                                                is_verified = Column(Boolean, default=False, nullable=False)
                                                                                                                                    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
                                                                                                                                    
                                                                                                                                        created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
                                                                                                                                            updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
                                                                                                                                            
                                                                                                                                                # Relationships
                                                                                                                                                    project = relationship("Project", back_populates=None)
                                                                                                                                                        signals = relationship("RadarSignal", back_populates="entry", cascade="all, delete-orphan")
                                                                                                                                                        
                                                                                                                                                            def __repr__(self):
                                                                                                                                                                    return f"<RadarEntry name={self.name} country={self.country} sector={self.sector}>"
                                                                                                                                                                    
                                                                                                                                                                    
                                                                                                                                                                    class RadarSignal(Base):
                                                                                                                                                                        """Intelligence signals / updates attached to a radar entry."""
                                                                                                                                                                            __tablename__ = "radar_signals"
                                                                                                                                                                            
                                                                                                                                                                                id = Column(Integer, primary_key=True, autoincrement=True)
                                                                                                                                                                                    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)
                                                                                                                                                                                        entry_id = Column(Integer, ForeignKey("radar_entries.id", ondelete="CASCADE"), nullable=False)
                                                                                                                                                                                        
                                                                                                                                                                                            signal_type = Column(String(50), nullable=False)
                                                                                                                                                                                                # news, funding, regulatory, risk, opportunity, milestone
                                                                                                                                                                                                    title = Column(String(255), nullable=False)
                                                                                                                                                                                                        summary = Column(Text, nullable=True)
                                                                                                                                                                                                            source_url = Column(String(1000), nullable=True)
                                                                                                                                                                                                                source_name = Column(String(255), nullable=True)
                                                                                                                                                                                                                    sentiment = Column(String(20), nullable=True)  # positive, neutral, negative
                                                                                                                                                                                                                        importance = Column(Integer, default=5, nullable=False)  # 1-10
                                                                                                                                                                                                                        
                                                                                                                                                                                                                            published_at = Column(DateTime, nullable=True)
                                                                                                                                                                                                                                created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
                                                                                                                                                                                                                                
                                                                                                                                                                                                                                    # Relationships
                                                                                                                                                                                                                                        entry = relationship("RadarEntry", back_populates="signals")
                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                            def __repr__(self):
                                                                                                                                                                                                                                                    return f"<RadarSignal type={self.signal_type} entry={self.entry_id}>"
