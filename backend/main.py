# main.py - deploy trigger
import os
import sys
from pathlib import Path

from fastapi import FastAPI
"""
AIP Platform - FastAPI Backend
Africa Infrastructure Projects
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.database import engine
from backend.models import Base
from backend.routers.analytics import router as analytics_router
from backend.routers.airtable import router as airtable_router
from backend.routers.auth import router as auth_router
from backend.routers.data_rooms import router as data_rooms_router
from backend.routers.deal_rooms import router as deal_rooms_router
from backend.routers.events import router as events_router
from backend.routers.introductions import router as introductions_router
from backend.routers.investors import router as investors_router
from backend.routers.projects import router as projects_router
from backend.routers.verifications import router as verifications_router

logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aip")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
        logger.info("AIP API starting up ...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created")
        yield
        logger.info("AIP API shutting down")
    
def _build_allowed_origins() -> list[str]:
        raw = os.getenv("ALLOWED_ORIGINS", "")
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        prod_origins = ["https://aip-plum.vercel.app"]
        for o in prod_origins:
                    if o not in origins:
                                    origins.append(o)
                            if not origins:
                                        origins = ["http://localhost:3000", "http://localhost:3001"]
                                    return origins
            
app = FastAPI(
        title="AIP API",
        description="Africa Infrastructure Projects Platform API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
                    status_code=500,
                    content={"detail": "An unexpected error occurred. Please try again later."},
        )
    
@app.get("/", tags=["Health"])
def root():
        return {"status": "AIP API is running", "version": "2.0.0", "docs": "/docs"}
    
@app.get("/health", tags=["Health"])
def health_check():
        return {"status": "healthy", "service": "aip-api"}
    
@app.get("/ping", tags=["Health"])
def ping():
        return {"pong": True}
    
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
        from fastapi.responses import Response
        return Response(status_code=204)
    
app.include_router(auth_router)
"a"p"p
.AiInPc lPuldaet_froorumt e-r (FparsotjAePcIt sB_arcokuetnedr
                              )A
farpipc.ai nIcnlfurdaes_trrouuctteurr(ei nPvreosjteocrtss_
                                      r"o"u"t
                                      eirm)p
oarptp .liongcgliundge
_irmopuotretr (oisn
               tfrroodmu cctoinotnesx_trloiubt eirm)p
oarptp .aisnycnlcucdoen_treoxuttmearn(adgaetra
                                      _frrooomm sp_artohultiebr )i
mappopr.ti nPcaltuhd
e
_frrooumt efra(sdteaapli_ riomopmosr_tr oFuatsetrA)P
Ia,p pR.eiqnucelsutd
ef_rroomu tfears(taanpail.ymtiidcdsl_erwoaurtee.rc)o
rasp pi.mipnocrltu dCeO_RrSoMuitdedrl(eewvaernet
                                      sf_rroomu tfears)t
aappip..rienscploundsee_sr oiumtpeorr(tv eJrSiOfNiRceastpioonnsse_
                                      rforuotme rf)a
satpapp.ii.nsctlautdiec_frioluetse ri(mapiorrtta bSltea_triocuFtielre)s

ng.getLogger("aip")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
        logger.info("AIP API starting up ...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created")
        yield
        logger.info("AIP API shutting down")

def _build_allowed_origins() -> list[str]:
        raw = os.getenv("ALLOWED_ORIGINS", "")
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        prod_origins = ["https://aip-plum.vercel.app"]
        for o in prod_origins:
                    if o not in origins:
                                    origins.append(o)
                            if not origins:
                                        origins = ["http://localhost:3000", "http://localhost:3001"]
                                    return origins

app = FastAPI(
        title="AIP API",
        description="Africa Infrastructure Projects Platform API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
        CORSMiddleware,
        allow_origins=_build_allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
                    status_code=500,
                    content={"detail": "An unexpected error occurred. Please try again later."},
        )

@app.get("/", tags=["Health"])
def root():
        return {"status": "AIP API is running", "version": "2.0.0", "docs": "/docs"}

@app.get("/health", tags=["Health"])
def health_check():
        return {"status": "healthy", "service": "aip-api"}

@app.get("/ping", tags=["Health"])
def ping():
        return {"pong": True}

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
        from fastapi.responses import Response
        return Response(status_code=204)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(investors_router)
app.include_router(introductions_router)
app.include_router(data_rooms_router)
app.include_router(deal_rooms_router)
app.include_router(analytics_router)
app.include_router(events_router)
app.include_router(verifications_router)
app.include_router(airtable_router)

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(_static_dir), html=True), name="frontend")

if __name__ == "__main__":
        import uvicorn
        port = int(os.getenv("PORT", 8000))
        uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
f_rsotma tsilco_wdaipri  =i mPpaotrht( _L_ifmiiltee_r_,) ._praarteen_tl i/m i"ts_teaxtciece"d
eidf_ h_asntdalteirc
_fdriorm. esxlioswtasp(i).:e
r r o r sa pipm.pmoorutn tR(a"t/esLtiamtiitcE"x,c eSetdaetdi
                            cfFriolme ss(ldoiwraepcit.ourtyi=ls tirm(p_osrtta tgiect__drierm)o,t eh_tamdld=rTersuse
                                                                                                 )
,f rnoamm eb=a"cfkreonndt.ednadt"a)b
a
sief  i_m_pnoarmte _e_n g=i=n e"
_f_rmoami nb_a_c"k:e
n d . m oidmeplosr ti mupvoircto rBna
s e 
 f rpoomr tb a=c kienntd(.orso.ugteetresn.va(n"aPlOyRtTi"c,s  8i0m0p0o)r)t
   r o u tuevri caosr na.nraulny(t"ibcasc_kreonudt.emra
   ifnr:oamp pb"a,c kheonsdt.=r"o0u.t0e.r0s..0a"i,r tpaobrlte= piomrpto,r tr erloouatde=rT rause )airtable_router
   from backend.routers.auth import router as auth_router
   from backend.routers.data_rooms import router as data_rooms_router
   from backend.routers.deal_rooms import router as deal_rooms_router
   from backend.routers.events import router as events_router
   from backend.routers.introductions import router as introductions_router
   from backend.routers.investors import router as investors_router
   from backend.routers.projects import router as projects_router
   from backend.routers.verifications import router as verifications_router
   
   logging.basicConfig(
       level=logging.INFO,
           format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
           )
           logger = loggifrom fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.models import Base
from backend.routers.projects import router as projects_router
from backend.routers.verifications import router as verifications_router
from backend.routers.investors import router as investors_router
from backend.routers.introductions import router as introductions_router
from backend.routers.data_rooms import router as data_rooms_router
from backend.routers.analytics import router as analytics_router
from backend.routers.events import router as events_router
from backend.routers.auth import router as auth_router
from backend.routers.deal_rooms import router as deal_rooms_router
from backend.routers.airtable import router as airtable_router
from backend.routers.verification import router as verification_v2_router
from backend.database import engine

# Create FastAPI app
app = FastAPI(
    title="AIP API",
    version="1.0.0"
)

# CORS configuration from environment variable
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

# Fallback for local development
if not allowed_origins:
    allowed_origins = ["http://localhost:3000", "http://localhost:3001", "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.(vercel\.app|up\.railway\.app)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "AIP API is running", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "aip-api"}

@app.get("/ping")
def ping():
    return {"pong": True}

@app.get("/favicon.ico")
def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)

@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully")
    except Exception as e:
        print(f"Database initialization warning (non-fatal): {e}")

# Mount static files after app is created
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir), html=True), name="frontend")


app.include_router(projects_router)
app.include_router(verifications_router)
app.include_router(investors_router)
app.include_router(introductions_router)
app.include_router(data_rooms_router)
app.include_router(analytics_router)
app.include_router(events_router)
app.include_router(auth_router)
app.include_router(deal_rooms_router)
app.include_router(verification_v2_router)
app.include_router(airtable_router)

# Run with uvicorn
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
