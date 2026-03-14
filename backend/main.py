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
        

def _build_allowed_origins() -> list:
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
          " " "a
          lAlIoPw _Phleaatdfeorrsm= [-" *F"a]s,t
          A)P
          I
           
           B@aacpkpe.nedx
           cAefprtiicoan _Ihnafnrdalsetrr(uEcxtcuerpet iPorno)j
           eacstysn
           c" "d"e
           fi mgploorbta ll_oegxgcienpgt
           iiomnp_ohratn dolse
           rf(rroemq uceosntt:e xRtelqiube sitm,p oerxtc :a sEyxnccecpotnitoenx)t:m
           a n a g elro
           gfgreorm. epxactehpltiibo ni(m"pUonrhta nPdaltehd
            
            efxrcoemp tfiaosnt aopni  %ism p%osr"t,  FraesqtuAePsIt,. mReetqhuoeds,t 
            rferqoume sfta.sutralp)i
            . m i d drleetwuarrne .JcSoOrNsR eismppoonrste (C
            O R S M i d d l eswtaarteu
            sf_rcoomd ef=a5s0t0a,p
            i . r e s p o n sceosn tiemnpto=r{t" dJeStOaNiRle"s:p o"nAsne 
            ufnreoxmp efcatsetda peir.rsotra toicccfuirlreesd .i mPploerats eS ttartyi caFgialiens 
            lfartoemr .s"l}o,w
            a p i   i)m
            p
            o
            r@ta pLpi.mgiette(r",/ "_,r attaeg_sl=i[m"iHte_aelxtche"e]d)e
            dd_ehfa nrdoloetr(
            )f:r
            o m   s lroewtauprin. e{r"rsotrast uism"p:o r"tA IRPa tAePLIi miist Erxucneneidnegd"
            ,f r"ovme rsslioowna"p:i ."u2t.i0l. 0i"m,p o"rdto cgse"t:_ r"e/mdootces_"a}d
            d
            r
            e@sasp
            p
            .fgreotm( "b/ahcekaelntdh."d,a ttaabgass=e[ "iHmepaolrtth "e]n)g
            idneef
             fhreoaml tbha_cckheencdk.(m)o:d
             e l s   irmeptourrtn  B{a"sset
             aftruosm" :b a"chkeeanldt.hryo"u,t e"rsse.ravniacley"t:i c"sa iipm-paoprit" }r
             o
             u
             t@earp pa.sg eatn(a"l/yptiincgs"_,r otuatgesr=
             [f"rHoema lbtahc"k]e)n
             dd.erfo uptienrgs(.)a:i
             r t a b lree tiumrpno r{t" proonugt"e:r  Tarsu ea}i
             r
             t
             a@balpep_.rgoeutt(e"r/
             ffarvoimc obna.cikceon"d,. rionuctleurdse._aiunt_hs cihmepmoar=tF arlosuet)e
             rd eafs  faauvtihc_orno(u)t:e
             r 
              f r ofmr obma cfkaesntda.prio.urteesrpso.ndsaetsa _irmopoomrst  iRmepsoprotn sreo
              u t e r  raest udrant aR_ersopoomnss_er(osuttaetru
              sf_rcoomd eb=a2c0k4e)n
              d
              .
              raopupt.eirnsc.lduedael__rroouotmesr (iamuptohr_tr oruotuetre)r
               aapsp .dienacll_urdoeo_mrso_urtoeurt(eprr
               ofjreocmt sb_arcokuetnedr.)r
               oauptpe.risn.celvuednet_sr oiumtpeorr(ti nrvoeustteorr sa_sr oeuvteenrt)s
               _arpopu.tienrc
               lfurdoem_ rboauctkeern(di.nrtoruotdeurcst.iionntsr_ordouuctteiro)n
               sa pipm.pionrctl urdoeu_treoru taesr (idnattrao_druocotmiso_nrso_urtoeurt)e
               ra
               pfpr.oimn cblaucdkee_nrdo.urtoeurt(edresa.li_nrvoeosmtso_rrso uitmepro)r
               ta prpo.uitnecrl uadse _irnovuetsetro(rasn_arloyuttiecrs
               _frrooumt ebra)c
               kaepnpd..irnocultuedres_.rporuotjeerc(tesv einmtpso_rrto urtoeurt)e
ra paps. ipnrcoljuedcet_sr_oruotuetre(rv
efrriofmi cbaatcikoennsd_.rroouutteerr)s
.avpepr.iifnicclautdieo_nrso uitmepro(rati rrtoaubtleer_ raosu tveerr)i
f
i_csattaitoincs__drioru t=e rP
a
tlho(g_g_ifnigl.eb_a_s)i.cpCaornefnitg (/
  " s t alteivce"l
  =ilfo g_gsitnagt.iIcN_FdOi,r
  . e x i sftosr(m)a:t
  = " % ( aaspcpt.immoeu)nst (|" /%s(tlaetviecl"n,a mSet)a-t8isc F|i l%e(sn(admier)esc t|o r%y(=msetsrs(a_gset)ast"i,c
  _)d
  ilro)g,g ehrt m=l =lTorgugei)n,g .ngaemteL=o"gfgreorn(t"eanidp""))
  
  
  
  ilfi m_i_tnearm e=_ _L i=m=i t"e_r_(mkaeiyn__f_u"n:c
  = g e t _irmepmoortte _uavdidcroersns
  ,   d e fpaourltt _=l iimnitt(so=s[."g2e0t0e/nmvi(n"uPtOeR"T]"),
   
   8
   0@0a0s)y)n
   c c o n tuevxitcmoarnna.greurn
   (a"sbyancck ednedf. mlaiifne:sappapn"(,a phpo:s tF=a"s0t.A0P.I0).:0
   " ,   p olrotg=gpeorr.ti,n froe(l"oAaIdP= TArPuIe )starting up ...")
       Base.metadata.create_all(bind=engine)
           logger.info("Database tables verified/created")
               yield
                   logger.info("AIP API shutting down")
                   
                   
                   def _build_allowed_origins() -> list:
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
                                                                                                                                                                                   uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)# main.py
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
        return {"status": "AIP API is running", "version": "2.0"."0""
        ,A I"Pd oPclsa"t:f o"r/md o-c sF"a}s
        t
        A@PaIp pB.agcekte(n"d/
        hAefarlitcha" ,I ntfargass=t[r"uHcetaulrteh "P]r)o
        jdeecft sh
        e"a"l"t
        hi_mcphoerctk (l)o:g
        g i n g 
        riemtpuorrnt  {o"ss
        tfartoums "c:o n"theexatlltihby "i,m p"osretr vaiscyen"c:c o"natiepx-tampain"a}g
        e
        r@
        afprpo.mg epta(t"h/lpiibn gi"m,p otratg sP=a[t"hH
        e
        aflrtohm" ]f)a
        sdteafp ip iinmgp(o)r:t
          F a s trAePtIu,r nR e{q"upeosntg
          "f:r oTmr ufea}s
          t
          a@paip.pm.igdedtl(e"w/afraev.iccoorns. iicmop"o,r ti nCcOlRuSdMei_didnl_eswcahreem
          af=rFoaml sfea)s
          tdaepfi .fraevsipcoonns(e)s: 
          i m p o rftr oJmS OfNaRsetsappoin.sree
          sfproonms efsa sitmappoir.ts tRaetsipcofnislee
          s   i m proerttu rSnt aRteiscpFoinlsees(
          sftraotmu ss_lcoowdaep=i2 0i4m)p
          o
          ratp pL.iimnictleurd,e __rroauttee_rl(iamuitth__erxocueteedre)d
          _ahpapn.dilnecrl
          ufdreo_mr osultoewra(ppir.oejrercotrss_ riomuptoerrt) 
          Raaptpe.LiinmciltuEdxec_ereoduetde
          rf(rionmv essltoowrasp_ir.ouuttielr )i
          mappopr.ti ngceltu_dree_mrootuet_eard(dirnetsrso
          d
          ufcrtoimo nbsa_crkoeuntde.rd)a
          taapbpa.sien cilmupdoer_tr oeuntgeirn(ed
          aftrao_mr oboamcsk_ernodu.tmeord)e
          lasp pi.mipnocrltu dBea_sreo
          uftreorm( dbeaaclk_ernodo.mrso_urtoeurtse.ra)n
          aalpypt.iicnsc liumdpeo_rrto urtoeurt(earn aalsy taincasl_yrtoiuctse_rr)o
          uatpepr.
          ifnrcolmu dbea_crkoeuntde.rr(oeuvteenrtss._arioruttaebrl)e
           aipmpp.oirntc lruoduet_erro uatse ra(ivretraibfliec_artoiuotnesr_
           rforuotme rb)a
           cakpepn.di.nrcoluutdeer_sr.oauuttehr (iamiprotratb lreo_urtoeurt ears) 
           a
           u_tsht_artoiuct_edri
           rf r=o mP abtahc(k_e_nfdi.lreo_u_t)e.rpsa.rdeantta _/r o"osmtsa tiimcp"o
           ritf  r_osuttaetri ca_sd idra.teax_irsotosm(s)_:r
           o u t e ra
           pfpr.ommo ubnatc(k"e/nsdt.artoiuct"e,r sS.tdaetailc_Frioloemss( diimrpeocrtto rryo=ustterr( _asst adteiacl__drioro)m,s _hrtomult=eTrr
           ufer)o,m  nbaamcek=e"nfdr.ornotuetnedr"s).
           e
           viefn t_s_ niammpeo_r_t  =r=o u"t_e_rm aaisn _e_v"e:n
           t s _ r oiumtpeorr
           tf ruovmi cboarcnk
           e n d . rpoourtte r=s .iinntt(roosd.ugcettieonnvs( "iPmOpRoTr"t,  r8o0u0t0e)r) 
           a s   i nutvriocdourcnt.irounns(_"rboauctkeern
           df.rmoami nb:aacpkpe"n,d .hroosutt=e"r0s..0i.n0v.e0s"t,o rpso ritm=ppoorrtt ,r oruetleora da=sT riunev)estors_router
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
                                                                                                                                                                                                       uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)from fastapi.middleware.cors import CORSMiddleware
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
    Base.metadata.create_all(bind=engine)

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

# Run with uvicorn
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
