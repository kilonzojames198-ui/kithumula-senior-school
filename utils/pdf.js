const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const NAVY='#0f2444',RED='#c0131c',GOLD='#d4a017',GRAY='#64748b',LGRAY='#f1f5f9',LGRAY2='#e8edf4',BLACK='#1a1f2e',WHITE='#ffffff',GREEN='#065f46',BLUE='#1e40af',AMBER='#92400e';
const LOGO_PATH = path.join(__dirname,'..','public','images','logo.png');
const L=40, R=555, W=R-L;

function gradeColor(g){return g==='EE'?GREEN:g==='ME'?BLUE:g==='AE'?AMBER:RED;}
function gradeBg(g){return g==='EE'?'#d1fae5':g==='ME'?'#dbeafe':g==='AE'?'#fef9c3':'#fee2e2';}
function hline(doc,x1,y,x2,c='#dde4ee',w=0.5){doc.moveTo(x1,y).lineTo(x2,y).lineWidth(w).strokeColor(c).stroke();}
function lv(doc,label,value,x,y,lw=80){
  doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY).text(label.toUpperCase(),x,y,{width:lw});
  doc.font('Helvetica').fontSize(9).fillColor(BLACK).text(value||'—',x,y+9,{width:lw+50});
}

function generateStudentReport(doc,student,classInfo,results,examTypes,term,year,rank,classSize){
  const pW=595;
  // TOP STRIPES
  doc.rect(0,0,pW,8).fill(RED);
  doc.rect(0,8,pW,4).fill(GOLD);
  let y=20;

  // HEADER
  const hH=92;
  doc.rect(L,y,W,hH).fill(NAVY);

  // Logo circle
  const lsz=70,lx=L+12,ly=y+11;
  if(fs.existsSync(LOGO_PATH)){
    try{
      doc.save();doc.circle(lx+lsz/2,ly+lsz/2,lsz/2).clip();
      doc.image(LOGO_PATH,lx,ly,{width:lsz,height:lsz});doc.restore();
      doc.circle(lx+lsz/2,ly+lsz/2,lsz/2).lineWidth(2).strokeColor(GOLD).stroke();
    }catch(e){}
  }

  // School text
  const tx=L+92,tw=W-182;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE).text('KITHUMULA SENIOR SCHOOL',tx,y+12,{width:tw,align:'center'});
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)').text('Matinyani Sub-County, Kitui County, Kenya',tx,y+31,{width:tw,align:'center'});
  doc.font('Helvetica').fontSize(7.5).fillColor('rgba(255,255,255,0.5)').text('info@kithumula.sc.ke  |  "Forward Ever, Backwards Never"',tx,y+43,{width:tw,align:'center'});
  doc.rect(tx+(tw/2)-35,y+57,70,2).fill(RED);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GOLD).text('ACADEMIC REPORT FORM',tx,y+63,{width:tw,align:'center'});

  // Passport photo
  const psz=70,px=R-psz-12,py=y+11;
  const spPath=student.photo?path.join(__dirname,'..','public',student.photo):null;
  doc.rect(px,py,psz,psz).fill(LGRAY2);
  if(spPath&&fs.existsSync(spPath)){
    try{doc.save();doc.rect(px,py,psz,psz).clip();doc.image(spPath,px,py,{width:psz,height:psz,cover:[psz,psz]});doc.restore();}catch(e){}
  } else {
    doc.font('Helvetica').fontSize(7).fillColor(GRAY).text('PHOTO',px,py+30,{width:psz,align:'center'});
  }
  doc.rect(px,py,psz,psz).lineWidth(2).strokeColor(GOLD).stroke();
  y+=hH+8;

  // STUDENT INFO BAND
  doc.rect(L,y,W,54).fill(LGRAY);
  const c1=L+10,c2=L+140,c3=L+270,c4=L+390;
  lv(doc,'Student Name',student.name.toUpperCase(),c1,y+6,125);
  lv(doc,'Admission No.',student.adm_number,c2,y+6,90);
  lv(doc,'Class',classInfo.name,c3,y+6,80);
  lv(doc,'Term / Year',`${term}  |  ${year}`,c4,y+6,100);
  lv(doc,'Gender',student.gender||'—',c1,y+28,60);
  lv(doc,'Class Rank',rank?`${rank} of ${classSize}`:'Pending',c2,y+28,90);
  lv(doc,'Mean Points',results.meanPoints?(results.meanPoints.toFixed(2)):'—',c3,y+28,80);
  // Overall grade
  const og=results.overallGrade||'—';
  const ogBg=og!=='—'?gradeBg(og):LGRAY2;
  const ogC=og!=='—'?gradeColor(og):GRAY;
  doc.rect(c4,y+28,78,22).fill(ogBg);
  doc.font('Helvetica-Bold').fontSize(6).fillColor(ogC).text('OVERALL GRADE',c4+2,y+29,{width:74,align:'center'});
  doc.font('Helvetica-Bold').fontSize(14).fillColor(ogC).text(og,c4+2,y+37,{width:74,align:'center'});
  y+=62;

  // MARKS TABLE
  const RH=17;
  const CN={no:L,subj:L+18,c1:L+250,c2:L+300,et:L+350,tot:L+408,gr:L+450,pts:L+488};

  // Table header
  doc.rect(L,y,W,RH+2).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(WHITE);
  doc.text('#',CN.no,y+5,{width:16,align:'center'});
  doc.text('SUBJECT / LEARNING AREA',CN.subj,y+5,{width:225});
  examTypes.forEach((et,i)=>{
    const xs=[CN.c1,CN.c2,CN.et];
    if(xs[i]!==undefined){
      doc.text(et.name.toUpperCase(),xs[i],y+3,{width:46,align:'center'});
      doc.font('Helvetica').fontSize(5.5).fillColor('rgba(255,255,255,0.55)').text(`/${et.weight}`,xs[i],y+12,{width:46,align:'center'});
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(WHITE);
    }
  });
  doc.text('TOTAL%',CN.tot,y+5,{width:38,align:'center'});
  doc.text('GRADE',CN.gr,y+5,{width:36,align:'center'});
  doc.text('PTS',CN.pts,y+5,{width:20,align:'center'});
  y+=RH+2;

  const drawGroup=(rows,label)=>{
    if(!rows.length)return;
    doc.rect(L,y,W,13).fill('#e2e8f3');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(NAVY).text(label,L+8,y+3,{width:W-16});
    y+=13;
    rows.forEach((r,i)=>{
      const bg=i%2===0?WHITE:'#fafbfd';
      doc.rect(L,y,W,RH).fill(bg);
      hline(doc,L,y+RH,R,'#e4e9f0');
      const rn=results.results.indexOf(r)+1;
      doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(rn,CN.no,y+5,{width:16,align:'center'});
      doc.font('Helvetica').fontSize(8).fillColor(BLACK).text(r.subject.name,CN.subj,y+5,{width:225});
      examTypes.forEach((et,idx)=>{
        const xs=[CN.c1,CN.c2,CN.et];
        if(xs[idx]===undefined)return;
        const entry=r.breakdown?r.breakdown.find(b=>b.exam_type_id===et.id):null;
        if(entry){
          doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text(`${entry.marks_obtained}`,xs[idx],y+5,{width:46,align:'center'});
        } else {
          doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text('—',xs[idx],y+5,{width:46,align:'center'});
        }
      });
      if(r.total!==null&&r.total!==undefined){
        const bW=36,fc=r.grade==='EE'?'#059669':r.grade==='ME'?'#2563eb':r.grade==='AE'?'#d97706':'#dc2626';
        doc.rect(CN.tot,y+3,bW,RH-6).fill('#e8edf4');
        doc.rect(CN.tot,y+3,Math.max(2,(r.total/100)*bW),RH-6).fill(fc);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE).text(`${r.total.toFixed(0)}%`,CN.tot,y+5,{width:bW,align:'center'});
        doc.rect(CN.gr+2,y+3,30,RH-6).fill(gradeBg(r.grade));
        doc.font('Helvetica-Bold').fontSize(8).fillColor(gradeColor(r.grade)).text(r.grade,CN.gr+2,y+5,{width:30,align:'center'});
        doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(r.points,CN.pts,y+5,{width:20,align:'center'});
      } else {
        doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text('—',CN.tot,y+5,{width:38,align:'center'});
        doc.text('—',CN.gr,y+5,{width:36,align:'center'});
        doc.text('—',CN.pts,y+5,{width:20,align:'center'});
      }
      y+=RH;
    });
  };

  const core=results.results.filter(r=>r.subject.is_core);
  const path2=results.results.filter(r=>!r.subject.is_core);
  if(core.length)drawGroup(core,'CORE SUBJECTS');
  if(path2.length)drawGroup(path2,'PATHWAY SUBJECTS');

  // TOTALS ROW
  doc.rect(L,y,W,20).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE);
  doc.text('AGGREGATE SUMMARY',L+8,y+6,{width:200});
  doc.text(`Subjects: ${results.subjectCount}`,CN.c1,y+6,{width:140});
  doc.text(`Total Pts: ${results.totalPoints}`,CN.et,y+6,{width:80});
  doc.text(results.meanPoints?(results.meanPoints.toFixed(2)):'—',CN.tot,y+6,{width:38,align:'center'});
  doc.fillColor(og!=='—'?(og==='EE'?GOLD:og==='ME'?'#93c5fd':og==='AE'?'#fcd34d':'#fca5a5'):WHITE)
     .text(og,CN.gr,y+6,{width:50,align:'center'});
  y+=24;

  // GRADE KEY
  doc.rect(L,y,W,14).fill(LGRAY);
  const keys=[{g:'EE',l:'Exceeds Expectation (80-100%)',c:GREEN,bg:'#d1fae5'},{g:'ME',l:'Meets Expectation (65-79%)',c:BLUE,bg:'#dbeafe'},{g:'AE',l:'Approaches (50-64%)',c:AMBER,bg:'#fef9c3'},{g:'BE',l:'Below Expectation (<50%)',c:RED,bg:'#fee2e2'}];
  let kx=L+4;
  keys.forEach(k=>{doc.rect(kx,y+3,14,8).fill(k.bg);doc.font('Helvetica-Bold').fontSize(5.5).fillColor(k.c).text(k.g,kx,y+4,{width:14,align:'center'});doc.font('Helvetica').fontSize(6).fillColor(GRAY).text(k.l,kx+16,y+4);kx+=122;});
  y+=18;

  // COMMENTS & SIGNATURES
  const cH=58;
  // Class teacher
  doc.rect(L,y,W/2-4,cH).fill(WHITE).lineWidth(0.8).strokeColor(LGRAY2).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text("CLASS TEACHER'S REMARKS",L+8,y+7);
  hline(doc,L+8,y+20,L+W/2-12,'#c5cdd8');
  hline(doc,L+8,y+32,L+W/2-12,'#c5cdd8');
  if(student.class_teacher_comment){doc.font('Helvetica').fontSize(8).fillColor(BLACK).text(student.class_teacher_comment,L+8,y+22,{width:W/2-24,lineBreak:false});}
  doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY);
  doc.text('Sign:',L+8,y+cH-14);hline(doc,L+30,y+cH-7,L+W/2-70,'#c5cdd8');
  doc.text('Date:',L+W/2-65,y+cH-14);hline(doc,L+W/2-40,y+cH-7,L+W/2-12,'#c5cdd8');
  // Principal
  const rx=L+W/2+4;
  doc.rect(rx,y,W/2-4,cH).fill(WHITE).lineWidth(0.8).strokeColor(LGRAY2).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text("PRINCIPAL'S REMARKS",rx+8,y+7);
  hline(doc,rx+8,y+20,R-8,'#c5cdd8');
  hline(doc,rx+8,y+32,R-8,'#c5cdd8');
  if(student.principal_comment){doc.font('Helvetica').fontSize(8).fillColor(BLACK).text(student.principal_comment,rx+8,y+22,{width:W/2-24,lineBreak:false});}
  doc.font('Helvetica-Bold').fontSize(7).fillColor(GRAY);
  doc.text('Sign:',rx+8,y+cH-14);hline(doc,rx+30,y+cH-7,R-70,'#c5cdd8');
  doc.text('Date:',R-65,y+cH-14);hline(doc,R-42,y+cH-7,R-8,'#c5cdd8');
  y+=cH+6;

  // NEXT TERM BAND
  doc.rect(L,y,W,22).fill(LGRAY);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('NEXT TERM BEGINS:',L+8,y+7);
  hline(doc,L+108,y+15,L+220,'#b0bac8');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('SCHOOL CLOSES:',L+230,y+7);
  hline(doc,L+318,y+15,L+400,'#b0bac8');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('FEES BALANCE: KSh',L+410,y+7);
  hline(doc,L+510,y+15,R-8,'#b0bac8');
  y+=28;

  // FOOTER STRIPE
  doc.rect(L,y,W,12).fill(NAVY);
  doc.font('Helvetica').fontSize(6).fillColor('rgba(255,255,255,0.45)')
     .text(`Kithumula Senior School  |  Generated: ${new Date().toLocaleDateString('en-KE',{year:'numeric',month:'long',day:'numeric'})}  |  "Forward Ever, Backwards Never"`,
       L,y+3,{width:W,align:'center'});
  doc.rect(0,830,595,6).fill(RED);
  doc.rect(0,836,595,6).fill(GOLD);
}

function generateClassReportPDF(res,students,classInfo,allResults,examTypes,term,year,inline=false){
  const doc=new PDFDocument({margin:0,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="Reports_${classInfo.name.replace(/\s/g,'_')}.pdf"`);
  doc.pipe(res);
  const ranked=students.map(s=>({...s,result:allResults[s.id]||{results:[],totalPoints:0,meanPoints:0,overallGrade:'BE',subjectCount:0}}))
    .sort((a,b)=>b.result.meanPoints-a.result.meanPoints);
  ranked.forEach((st,i)=>{if(i>0)doc.addPage();generateStudentReport(doc,st,classInfo,st.result,examTypes,term,year,i+1,students.length);});
  doc.end();
}

function generateSingleStudentPDF(res,student,classInfo,result,examTypes,term,year,rank,classSize,inline=false){
  const doc=new PDFDocument({margin:0,size:'A4'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="Report_${student.adm_number}.pdf"`);
  doc.pipe(res);
  generateStudentReport(doc,student,classInfo,result,examTypes,term,year,rank,classSize);
  doc.end();
}

function generateClassSummaryPDF(res,students,classInfo,allResults,subjects,examTypes,term,year,inline=false){
  const doc=new PDFDocument({margin:30,size:'A4',layout:'landscape'});
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="Summary_${classInfo.name.replace(/\s/g,'_')}.pdf"`);
  doc.pipe(res);
  doc.rect(0,0,842,6).fill(RED);doc.rect(0,6,842,3).fill(GOLD);
  doc.rect(30,16,782,46).fill(NAVY);
  if(fs.existsSync(LOGO_PATH)){try{doc.image(LOGO_PATH,38,20,{width:38,height:38});}catch(e){}}
  doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE).text('KITHUMULA SENIOR SCHOOL',86,20,{width:666,align:'center'});
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)').text(`Class Performance Summary  |  ${classInfo.name}  |  ${term}, ${year}`,86,38,{width:666,align:'center'});
  doc.y=72;
  const ranked=students.map(s=>({...s,result:allResults[s.id]||{results:[],meanPoints:0,overallGrade:'BE'}})).sort((a,b)=>b.result.meanPoints-a.result.meanPoints);
  const activeSubs=subjects.filter(s=>students.some(st=>allResults[st.id]?.results?.find(r=>r.subject.id===s.id&&r.total!==null)));
  const cW=Math.min(40,Math.floor(470/Math.max(activeSubs.length,1)));
  const sX=30,nW=138,aW=48,rkW=26,stW=36;
  const hY=doc.y;
  doc.rect(sX,hY,782,17).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(WHITE);
  doc.text('RNK',sX+2,hY+4,{width:rkW});doc.text('STUDENT NAME',sX+rkW,hY+4,{width:nW});doc.text('ADM',sX+rkW+nW,hY+4,{width:aW});
  let cx=sX+rkW+nW+aW;
  activeSubs.forEach(s=>{doc.text(s.code,cx,hY+4,{width:cW,align:'center'});cx+=cW;});
  doc.text('MEAN%',cx,hY+4,{width:stW,align:'center'});doc.text('PTS',cx+stW,hY+4,{width:stW,align:'center'});doc.text('GRD',cx+stW*2,hY+4,{width:stW,align:'center'});
  doc.y=hY+17;
  ranked.forEach((st,i)=>{
    const ry=doc.y;
    doc.rect(sX,ry,782,14).fill(i%2===0?WHITE:'#f7f9fc');
    hline(doc,sX,ry+14,sX+782,'#dde4ee');
    doc.font(i<3?'Helvetica-Bold':'Helvetica').fontSize(7).fillColor(i<3?NAVY:BLACK);
    doc.text(i+1,sX+2,ry+3,{width:rkW});doc.text(st.name,sX+rkW,ry+3,{width:nW});
    doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(st.adm_number,sX+rkW+nW,ry+3,{width:aW});
    let sx=sX+rkW+nW+aW;
    activeSubs.forEach(subj=>{
      const r=st.result.results?.find(r=>r.subject.id===subj.id);
      if(r&&r.total!==null){doc.rect(sx,ry+1,cW-2,12).fill(gradeBg(r.grade));doc.font('Helvetica-Bold').fontSize(7).fillColor(gradeColor(r.grade)).text(r.total.toFixed(0),sx,ry+3,{width:cW-2,align:'center'});}
      else{doc.font('Helvetica').fontSize(7).fillColor('#cbd5e1').text('—',sx,ry+3,{width:cW,align:'center'});}
      sx+=cW;
    });
    const mp=st.result.meanPoints;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text(mp?(mp*25).toFixed(1):'—',sx,ry+3,{width:stW,align:'center'});
    doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(mp?mp.toFixed(2):'—',sx+stW,ry+3,{width:stW,align:'center'});
    const ogr=st.result.overallGrade;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(ogr?gradeColor(ogr):GRAY).text(ogr||'—',sx+stW*2,ry+3,{width:stW,align:'center'});
    doc.y=ry+14;
  });
  doc.moveDown(0.4);doc.rect(sX,doc.y,782,1).fill(NAVY);doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('SUBJECT STATISTICS:',sX,doc.y);doc.moveDown(0.25);
  activeSubs.forEach(subj=>{
    const vals=ranked.map(s=>s.result.results?.find(r=>r.subject.id===subj.id)?.total).filter(v=>v!=null);
    if(!vals.length)return;
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length,pass=vals.filter(v=>v>=50).length;
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY).text(`${subj.name}: Avg ${avg.toFixed(1)}%  |  High ${Math.max(...vals)}%  |  Low ${Math.min(...vals)}%  |  Pass ${((pass/vals.length)*100).toFixed(0)}%  |  EE:${vals.filter(v=>v>=80).length} ME:${vals.filter(v=>v>=65&&v<80).length} AE:${vals.filter(v=>v>=50&&v<65).length} BE:${vals.filter(v=>v<50).length}`,sX+8,doc.y);
    doc.moveDown(0.2);
  });
  doc.end();
}

module.exports={generateClassReportPDF,generateClassSummaryPDF,generateSingleStudentPDF};
