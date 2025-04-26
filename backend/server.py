from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
import os
import uuid
import logging
import httpx
from pathlib import Path
import random
from enum import Enum

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'coworking_db')]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'default_secret_key_for_jwt_please_change_in_production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Daily.co API key (to be set in .env)
DAILY_API_KEY = os.environ.get('DAILY_API_KEY', '')
DAILY_API_URL = "https://api.daily.co/v1"

# Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    timezone: Optional[str] = "UTC"

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    name: str
    email: str

class TokenData(BaseModel):
    email: str

class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SessionFeedback(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

class SessionBase(BaseModel):
    start_time: datetime
    end_time: datetime
    title: Optional[str] = "Coworking Session"
    description: Optional[str] = None

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_id: str
    partner_id: Optional[str] = None
    room_url: Optional[str] = None
    status: SessionStatus = SessionStatus.SCHEDULED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    feedback: Optional[Dict[str, SessionFeedback]] = None

    class Config:
        from_attributes = True

# Password and JWT functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user_by_email(email: str):
    user_dict = await db.users.find_one({"email": email})
    if user_dict:
        return UserInDB(**user_dict)
    return None

async def authenticate_user(email: str, password: str):
    user = await get_user_by_email(email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = await get_user_by_email(email=token_data.email)
    if user is None:
        raise credentials_exception
    return user

# Auth routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict(exclude={"password"})
    user_in_db = UserInDB(**user_dict, hashed_password=hashed_password)
    await db.users.insert_one(user_in_db.dict())
    
    return User(**user_dict)

@api_router.post("/auth/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email
    }

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return current_user

# Sessions routes
@api_router.post("/sessions", response_model=Session)
async def create_session(
    session: SessionCreate,
    current_user: UserInDB = Depends(get_current_user)
):
    session_dict = session.dict()
    
    # Create a session with the current user as host
    new_session = Session(
        **session_dict,
        host_id=current_user.id
    )
    
    # Insert into database
    await db.sessions.insert_one(new_session.dict())
    
    return new_session

@api_router.get("/sessions", response_model=List[Session])
async def get_user_sessions(
    current_user: UserInDB = Depends(get_current_user)
):
    sessions = await db.sessions.find(
        {"$or": [{"host_id": current_user.id}, {"partner_id": current_user.id}]}
    ).to_list(100)
    
    return [Session(**session) for session in sessions]

@api_router.get("/sessions/{session_id}", response_model=Session)
async def get_session(
    session_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    session = await db.sessions.find_one({"id": session_id})
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    # Check if user is allowed to view this session
    if session["host_id"] != current_user.id and session.get("partner_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this session"
        )
        
    return Session(**session)

@api_router.post("/sessions/{session_id}/join", response_model=Session)
async def join_session(
    session_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    session = await db.sessions.find_one({"id": session_id})
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    # Convert to Session object
    session_obj = Session(**session)
    
    # Check if session is already full
    if session_obj.partner_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already has a partner"
        )
        
    # Check if user is not trying to join their own session
    if session_obj.host_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot join your own session"
        )
    
    # If no room URL exists, create one
    if not session_obj.room_url and DAILY_API_KEY:
        try:
            room_name = f"coworking-{session_id}"
            expiry = int((session_obj.end_time.timestamp() - datetime.utcnow().timestamp()) + 3600)  # 1hr after session ends
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{DAILY_API_URL}/rooms",
                    headers={
                        "Authorization": f"Bearer {DAILY_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "name": room_name,
                        "properties": {
                            "exp": expiry,
                            "enable_chat": True
                        }
                    }
                )
                
                if response.status_code == 200:
                    room_data = response.json()
                    session_obj.room_url = room_data["url"]
                else:
                    logger.error(f"Failed to create Daily.co room: {response.text}")
        except Exception as e:
            logger.error(f"Error creating Daily.co room: {str(e)}")
    
    # Update session with partner and room URL if created
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {
            "partner_id": current_user.id,
            "room_url": session_obj.room_url
        }}
    )
    
    # Refresh session data
    updated_session = await db.sessions.find_one({"id": session_id})
    return Session(**updated_session)

@api_router.get("/sessions/available", response_model=List[Session])
async def get_available_sessions(
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        # Find sessions that don't have a partner and aren't hosted by the current user
        # and are scheduled in the future
        available_sessions = await db.sessions.find({
            "partner_id": None,
            "host_id": {"$ne": current_user.id},
            "start_time": {"$gt": datetime.utcnow()},
            "status": SessionStatus.SCHEDULED
        }).to_list(50)
        
        # Convert datetime objects to strings to make them JSON serializable
        sessions = []
        for session in available_sessions:
            # Handle potential missing fields
            if "start_time" in session and isinstance(session["start_time"], datetime):
                session["start_time"] = session["start_time"].isoformat()
            if "end_time" in session and isinstance(session["end_time"], datetime):
                session["end_time"] = session["end_time"].isoformat()
            if "created_at" in session and isinstance(session["created_at"], datetime):
                session["created_at"] = session["created_at"].isoformat()
                
            sessions.append(Session(**session))
        
        return sessions
    except Exception as e:
        logger.error(f"Error getting available sessions: {str(e)}")
        return []

@api_router.post("/sessions/{session_id}/feedback", response_model=Session)
async def submit_feedback(
    session_id: str,
    feedback: SessionFeedback,
    current_user: UserInDB = Depends(get_current_user)
):
    session = await db.sessions.find_one({"id": session_id})
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
        
    # Check if user is allowed to provide feedback
    if session["host_id"] != current_user.id and session.get("partner_id") != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to provide feedback for this session"
        )
    
    # Initialize feedback field if not exists
    if not session.get("feedback"):
        session["feedback"] = {}
    
    # Add feedback from current user
    user_role = "host" if session["host_id"] == current_user.id else "partner"
    session["feedback"][user_role] = feedback.dict()
    
    # Update session
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"feedback": session["feedback"]}}
    )
    
    updated_session = await db.sessions.find_one({"id": session_id})
    return Session(**updated_session)

@api_router.get("/search-partner", response_model=User)
async def search_partner(current_user: UserInDB = Depends(get_current_user)):
    # Find a random user who is not the current user
    users = await db.users.find({"id": {"$ne": current_user.id}}).to_list(100)
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No partners available"
        )
    
    # Return a random user as potential partner
    random_user = random.choice(users)
    return User(**random_user)

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Coworking Platform API"}

# Include the router in the main app
app.include_router(api_router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
