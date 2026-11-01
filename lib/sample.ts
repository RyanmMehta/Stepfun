import type { Lesson } from "./types";

export const SAMPLE_TITLE = "STAT-UB 103 · Regression with interaction terms";

// A dense, fast segment in a professor's voice: technical terms and numbers spoken inline.
export const SAMPLE_TRANSCRIPT =
  "Okay so let's go back to the salary model, we regressed salary in thousands on years of experience, a female indicator, and the interaction between the two. " +
  "Now the coefficient on experience is three point one, and remember that's holding everything else constant, but here's the thing, because we've included the interaction term, that three point one is the return to experience only for the baseline group, which is men, since female equals zero. " +
  "The interaction coefficient is negative zero point eight, so for women the slope on experience is three point one minus zero point eight, which gives you two point three. " +
  "So each additional year of experience is associated with about three thousand one hundred dollars more for men but only about two thousand three hundred more for women. " +
  "And notice, if you'd left the interaction out, you'd be forcing both groups to share one slope, which is exactly the assumption the data is telling you to drop. " +
  "Okay, questions on that before we move to the F test?";

// Canned output so Demo Mode needs zero API calls.
export const SAMPLE_LESSON: Lesson = {
  sentences: [
    "We are looking at a model that predicts salary.",
    "Salary is measured in thousands of dollars.",
    "The model uses three things: years of experience, whether the person is a woman, and those two multiplied together.",
    "That last part is called an interaction term.",
    "For men, each extra year of experience adds about $3,100 to salary.",
    "The interaction term is negative 0.8.",
    "This means experience pays less for women.",
    "For women, each extra year adds 3.1 minus 0.8, which is 2.3.",
    "So women get about $2,300 more per year of experience, not $3,100.",
    "The 3.1 number only describes men, because men are the starting group in this model.",
    "Without the interaction term, the model would force men and women to have the same slope.",
    "The data shows that this would be wrong.",
  ],
  glossary: [
    {
      term: "interaction term",
      simple_meaning: "Two variables multiplied together, so the effect of one can change depending on the other.",
      example_sentence: "The interaction term lets experience matter differently for men and women.",
    },
    {
      term: "coefficient",
      simple_meaning: "The number that says how much the prediction changes when one input goes up by 1.",
      example_sentence: "The coefficient on experience is 3.1, so one more year adds 3.1 thousand dollars.",
    },
    {
      term: "indicator variable",
      simple_meaning: "A variable that is 1 if something is true and 0 if it is not.",
      example_sentence: "The female indicator is 1 for women and 0 for men.",
    },
    {
      term: "holding constant",
      simple_meaning: "Keeping all the other inputs the same while you change just one.",
      example_sentence: "Holding gender constant, one more year of experience raises predicted salary.",
    },
    {
      term: "baseline group",
      simple_meaning: "The group where the indicator equals 0. Other groups are compared to it.",
      example_sentence: "Men are the baseline group because female equals 0 for them.",
    },
    {
      term: "slope",
      simple_meaning: "How fast the prediction goes up as one input goes up.",
      example_sentence: "The slope on experience is 2.3 for women.",
    },
    {
      term: "regressed on",
      simple_meaning: "Used a regression to predict one variable from other variables.",
      example_sentence: "We regressed salary on experience, meaning we predicted salary from experience.",
    },
  ],
  key_points: [
    "The interaction term lets experience have a different effect for women and men.",
    "Men: +$3,100 per extra year. Women: +$2,300 per extra year.",
    "The 3.1 coefficient applies only to the baseline group (men).",
    "Leaving the interaction out would wrongly force one shared slope.",
  ],
  quiz: [
    {
      question: "For women, how much does one extra year of experience add to predicted salary?",
      options: ["$3,100", "$2,300", "$800", "$3,900"],
      correct_index: 1,
      why: "For women you add the interaction to the experience coefficient: 3.1 + (−0.8) = 2.3, so about $2,300.",
      term: "interaction term",
    },
    {
      question: "Why does the 3.1 coefficient describe only men?",
      options: [
        "Because men earn more on average",
        "Because men are the baseline group, where the female indicator equals 0",
        "Because the interaction term is positive",
        "Because experience is measured only for men",
      ],
      correct_index: 1,
      why: "When female = 0 the interaction term disappears, so 3.1 is the slope for the baseline group: men.",
      term: "indicator variable",
    },
    {
      question: "What would happen if the professor left the interaction term out?",
      options: [
        "The model would give men and women the same slope on experience",
        "The salary numbers would be in dollars instead of thousands",
        "The female indicator would be removed too",
        "Nothing would change",
      ],
      correct_index: 0,
      why: "Without the interaction, one experience coefficient is shared by both groups, so the slopes are forced to be equal.",
      term: "slope",
    },
  ],
};
