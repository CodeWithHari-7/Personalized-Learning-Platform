from sqlalchemy.orm import Session
from app.models import Notification

def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    related_entity_type: str = None,
    related_entity_id: int = None
):
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        is_read=False,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
