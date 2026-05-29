// CBC Grade 10-12 grading: EE, ME, AE, BE
function getGrade(percent) {
  if (percent >= 80) return { grade: 'EE', label: 'Exceeds Expectation',  points: 4 };
  if (percent >= 65) return { grade: 'ME', label: 'Meets Expectation',    points: 3 };
  if (percent >= 50) return { grade: 'AE', label: 'Approaches Expectation', points: 2 };
  return              { grade: 'BE', label: 'Below Expectation',          points: 1 };
}

function getOverallGrade(meanPoints) {
  if (meanPoints >= 3.5) return 'EE';
  if (meanPoints >= 2.5) return 'ME';
  if (meanPoints >= 1.5) return 'AE';
  return 'BE';
}

// Given array of { marks_obtained, max_marks, contribution } calculate weighted total out of 100
function calcWeightedTotal(marksArr) {
  let totalContrib = marksArr.reduce((s, m) => s + (m.contribution || 100), 0);
  let weighted = marksArr.reduce((s, m) => {
    const pct = (m.marks_obtained / m.max_marks) * 100;
    return s + pct * ((m.contribution || 100) / totalContrib);
  }, 0);
  return Math.round(weighted * 100) / 100;
}

// Aggregate marks per student per subject across exam types for a term
// marksBySubject: { subjectId: [ { marks_obtained, max_marks, contribution, name } ] }
function aggregateStudentResults(marksBySubject, subjects) {
  const results = [];
  let totalPoints = 0, subjectCount = 0;

  subjects.forEach(subj => {
    const entries = marksBySubject[subj.id] || [];
    if (!entries.length) {
      results.push({ subject: subj, total: null, grade: null, points: null, breakdown: [] });
      return;
    }
    const total = calcWeightedTotal(entries);
    const { grade, label, points } = getGrade(total);
    totalPoints += points;
    subjectCount++;
    results.push({ subject: subj, total, grade, label, points, breakdown: entries });
  });

  const meanPoints = subjectCount ? totalPoints / subjectCount : 0;
  const overallGrade = getOverallGrade(meanPoints);

  return { results, totalPoints, meanPoints: Math.round(meanPoints * 100) / 100, overallGrade, subjectCount };
}

module.exports = { getGrade, getOverallGrade, calcWeightedTotal, aggregateStudentResults };
