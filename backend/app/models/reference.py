"""The doctor's personal Reference Library.

A shelf of references a doctor can look things up in. It is deliberately NOT connected to anything else in the
app: no approval workflow, no versions, nothing that feeds notes, rules, handovers or patients. Items either come
with the app (owner_user_id is NULL, loaded from the data files) or were added by one doctor for themselves.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class ReferenceItem(Base):
    __tablename__ = "reference_items"

    id = Column(String, primary_key=True, default=new_id)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)  # NULL: ships with the app
    ref_key = Column(String, nullable=True, unique=True)  # id in the data file, for items that ship with the app

    title = Column(String, nullable=False)
    issuer = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    category = Column(String, nullable=True)
    jurisdiction = Column(String, nullable=True)
    publication_date = Column(String, nullable=True)  # partial dates such as "2019" or "2025-12"
    edition_note = Column(String, nullable=True)  # the document's own edition / currency note
    source_url = Column(String, nullable=True)
    document_url = Column(String, nullable=True)
    summary = Column(Text, default="")
    notes = Column(Text, default="")  # the owner's own words (items the doctor added)
    rights_note = Column(Text, nullable=True)
    tags = Column(JSON, default=list)  # the owner's own search words

    file_path = Column(String, nullable=True)  # a PDF kept on this server, searched passage by passage
    page_count = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)

    chunks = relationship("ReferenceChunk", back_populates="item", cascade="all, delete-orphan")
    personal_notes = relationship("ReferenceNote", back_populates="item", cascade="all, delete-orphan")


class ReferenceChunk(Base):
    """One searchable passage of a reference's PDF, with its page, so a result can point back to the page."""

    __tablename__ = "reference_chunks"

    id = Column(String, primary_key=True, default=new_id)
    item_id = Column(String, ForeignKey("reference_items.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    section_label = Column(String, nullable=True)
    text = Column(Text, nullable=False)
    term_freq = Column(JSON, nullable=False, default=dict)  # {normalised word: count}
    token_count = Column(Integer, nullable=False, default=0)

    item = relationship("ReferenceItem", back_populates="chunks")


class ReferenceNote(Base):
    """A doctor's private note on any reference, including ones that ship with the app."""

    __tablename__ = "reference_notes"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_reference_note_user_item"),)

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(String, ForeignKey("reference_items.id"), nullable=False, index=True)
    text = Column(Text, default="")
    updated_at = Column(DateTime, default=now)

    item = relationship("ReferenceItem", back_populates="personal_notes")
