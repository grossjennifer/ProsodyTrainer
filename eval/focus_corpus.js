/* ============================================================================
 * eval/focus_corpus.js — discourse focus stimuli (owner-supplied, 12 Nov 2026)
 * ----------------------------------------------------------------------------
 * Appendix A (Experiment 1, focus on content words) and Appendix B
 * (Experiment 2, focus on function words), pasted by the owner as text.
 * One entry per FOCUS-CONGRUOUS version: the context, the target sentence,
 * and the capitalised focus. `foilFocus` is the incongruous placement for
 * the same context, where the incongruous version shares that context.
 *
 * Split: by stimulus pair (both contexts of one target stay together);
 * every third pair within each appendix is held out. Fixed by that rule
 * before any focus rule was written.
 *
 * Transcription notes: curly quotes straightened; a stray "[" before the
 * James item removed; "(Focus congruence)" read as congruous. Focus on
 * "I" is not visible in plain text (it is always capitalised); where no
 * other capitals appear, the focus is taken to be "I" (to be confirmed).
 * Kept as given, flagged for the owner: "Instead, THEY watched SEINFELD"
 * (Mary is alone in that story).
 * ========================================================================== */
'use strict';
const FOCUS_ITEMS = [
 {
  "id": "focA-01",
  "set": "content",
  "pair": 0,
  "split": "dev",
  "context": "The children in the elementary school were drilled on what they should do in the event that the fire alarm goes off. To avoid panicking and to form orderly lines were the children's first instructions.",
  "target": "Next, they have instructions to leave.",
  "marked": "Next, they have instructions to LEAVE.",
  "focus": "LEAVE",
  "foilFocus": "INSTRUCTIONS"
 },
 {
  "id": "focA-02",
  "set": "content",
  "pair": 0,
  "split": "dev",
  "context": "As the Level 5 hurricane moved closer to the city, the city officials began urging citizens to take preventative action. The citizens were urged to prepare their homes and businesses for the onslaught of wind and rain before leaving.",
  "target": "Next, they have instructions to leave.",
  "marked": "Next, they have INSTRUCTIONS to leave.",
  "focus": "INSTRUCTIONS",
  "foilFocus": "LEAVE"
 },
 {
  "id": "focA-03",
  "set": "content",
  "pair": 1,
  "split": "dev",
  "context": "At the finishing school, all students were required to take an etiquette class. At the beginning, they were given a list of rules. The instructors reminded the students of the rules at every social gathering. The list of appropriate behaviors at dinner parties included not burping in public, keeping their elbows off the dinner table, and keeping their feet off the furniture.",
  "target": "The students were told to keep their feet off the coffee table.",
  "marked": "The students were told to keep their feet off the COFFEE TABLE.",
  "focus": "COFFEE TABLE"
 },
 {
  "id": "focA-04",
  "set": "content",
  "pair": 1,
  "split": "dev",
  "context": "Maria had spent all day cleaning the house. She wanted everything to be perfect for the party later that night. She heard her husband come in from outside and sit down on the couch. She scurried in to tell him not to mess up the place. Maria feared that her husband would place cold drinks and other messy items directly on the coffee table.",
  "target": "The husband was told to keep his feet off the coffee table.",
  "marked": "The husband was told to keep his FEET off the coffee table.",
  "focus": "FEET",
  "foilFocus": "COFFEE TABLE"
 },
 {
  "id": "focA-05",
  "set": "content",
  "pair": 2,
  "split": "held",
  "context": "Mary sat down with a sigh of relief. It had been a long, grueling day and she was glad it was over. She put her feet up on the coffee table and tried to relax. She turned on the radio and flipped through the stations. Unfortunately, the options on the radio, mostly call-in talk shows about old sitcoms like Seinfeld, were not appealing to listen to.",
  "target": "Instead, she watched Seinfeld.",
  "marked": "Instead, she WATCHED Seinfeld.",
  "focus": "WATCHED"
 },
 {
  "id": "focA-06",
  "set": "content",
  "pair": 2,
  "split": "held",
  "context": "Mary sat down with a sigh of relief. It had been a long, grueling day and she was glad it was over. She put her feet up on the coffee table and tried to relax. She turned on the television and flipped through the stations. Unfortunately, the options on the television, mostly old reruns, were not appealing to watch.",
  "target": "Instead, they watched Seinfeld.",
  "marked": "Instead, they watched SEINFELD.",
  "focus": "SEINFELD"
 },
 {
  "id": "focA-07",
  "set": "content",
  "pair": 3,
  "split": "dev",
  "context": "John and Mary went to a Halloween party together. John paid little attention to Mary during the festivities, even though they had gone steady for six months. Although John was nowhere to be found, Mary's ex-boyfriend Peter was very attentive and talked with her most of the evening. As the night wore on, Peter found himself more and more enamored by Mary. Peter decided to make his move.",
  "target": "Peter hugged Mary.",
  "marked": "Peter HUGGED Mary.",
  "focus": "HUGGED",
  "foilFocus": "PETER"
 },
 {
  "id": "focA-08",
  "set": "content",
  "pair": 3,
  "split": "dev",
  "context": "The party guests were discussing the events taking place at the Halloween celebration. Most of the guests noticed that Mary seemed depressed and had spent most of the evening by herself. Just then, one of the guests reported seeing something very interesting. With much hesitation, the observant guest spilled the breaking news that someone hugged Mary.",
  "target": "Peter hugged Mary.",
  "marked": "PETER hugged Mary.",
  "focus": "PETER",
  "foilFocus": "HUGGED"
 },
 {
  "id": "focA-09",
  "set": "content",
  "pair": 4,
  "split": "dev",
  "context": "Matt just returned from a long business trip to Europe. The transatlantic plane had landed and the passengers were beginning to depart via the concourse. Matt's girlfriend, Megan, excitedly watched as he emerged from the plane. Although the crowd was thick, Matt quickly navigated through the crowd to greet Megan.",
  "target": "Matt kissed Megan.",
  "marked": "Matt KISSED Megan.",
  "focus": "KISSED",
  "foilFocus": "MATT"
 },
 {
  "id": "focA-10",
  "set": "content",
  "pair": 4,
  "split": "dev",
  "context": "Megan went to the high school dance with her girlfriends. The girls were enjoying listening to the live music by the sidelines and watching their classmates dance. As Megan watched the dance floor, a boy snuck up from behind and kissed her on the cheek. Megan thought her former boyfriend, Paul, had kissed her.",
  "target": "Matt kissed Megan.",
  "marked": "MATT kissed Megan.",
  "focus": "MATT",
  "foilFocus": "KISSED"
 },
 {
  "id": "focA-11",
  "set": "content",
  "pair": 5,
  "split": "held",
  "context": "Two cars were speeding north on the expressway. Without warning, the driver of the Mustang cut in front of the Camaro to exit the highway. This near collision caused both drivers to lose control and swerve back and forth on the road. One car hit the soft gravel, flipped upside down, and caught fire.",
  "target": "The Mustang caught fire.",
  "marked": "The MUSTANG caught fire.",
  "focus": "MUSTANG",
  "foilFocus": "FIRE"
 },
 {
  "id": "focA-12",
  "set": "content",
  "pair": 5,
  "split": "held",
  "context": "Two cars were speeding north on the expressway. Without warning, the driver of the Mustang cut in front of a second car to exit the highway. This near collision caused the driver of the Mustang to lose control and swerve back and forth on the road. The Mustang hit the soft gravel and flipped upside down.",
  "target": "The Mustang caught fire.",
  "marked": "The Mustang caught FIRE.",
  "focus": "FIRE",
  "foilFocus": "MUSTANG"
 },
 {
  "id": "focA-13",
  "set": "content",
  "pair": 6,
  "split": "dev",
  "context": "The birthday celebration was a big hit. The guests were enjoying the double-layered birthday cake and homemade ice cream. The guests were discussing the gifts being unwrapped by the birthday boy. One guest asked if the red tie was a gift from Susan.",
  "target": "The guests replied, \"Brad gave him a red tie.\"",
  "marked": "The guests replied, \"BRAD gave him a red tie.\"",
  "focus": "BRAD",
  "foilFocus": "RED"
 },
 {
  "id": "focA-14",
  "set": "content",
  "pair": 6,
  "split": "dev",
  "context": "The birthday celebration was a big hit. The guests were enjoying the double-layered birthday cake and homemade ice cream. The guests were discussing the gifts being unwrapped by the birthday boy. One guest asked if Brad gave the birthday boy a greenish-yellow tie.",
  "target": "The guests replied, \"Brad gave him a red tie.\"",
  "marked": "The guests replied, \"Brad gave him a RED tie.\"",
  "focus": "RED"
 },
 {
  "id": "focA-15",
  "set": "content",
  "pair": 7,
  "split": "dev",
  "context": "The Christmas celebration was underway and all the children gathered around the tree, opening their presents. Wrapping paper was flying everywhere. Such chaos filled the room that it was hard to see the presents being opened. Uncle John asked if Little Johnnie got a red truck.",
  "target": "Mom replied, \"Pete got a red truck.\"",
  "marked": "Mom replied, \"PETE got a red truck.\"",
  "focus": "PETE",
  "foilFocus": "TRUCK"
 },
 {
  "id": "focA-16",
  "set": "content",
  "pair": 7,
  "split": "dev",
  "context": "The Christmas celebration was underway and all the children gathered around the tree, opening their presents. Wrapping paper was flying everywhere. Such chaos filled the room that it was hard to see the presents being opened. Uncle John asked if Pete got a red bicycle.",
  "target": "Mom replied, \"Pete got a red truck.\"",
  "marked": "Mom replied, \"Pete got a red TRUCK.\"",
  "focus": "TRUCK",
  "foilFocus": "PETE"
 },
 {
  "id": "focA-17",
  "set": "content",
  "pair": 8,
  "split": "held",
  "context": "Several GVSU students were looking forward to having a pleasant meal off campus at a nearby restaurant in Allendale. The students looked pleased when the waiter served their meals along with glasses of fresh-squeezed lemonade. Suddenly, with a look of disgust, one of the students stopped eating her garden salad. The student spit out a bite of salad.",
  "target": "A moth was in her salad.",
  "marked": "A MOTH was in her salad.",
  "focus": "MOTH"
 },
 {
  "id": "focA-18",
  "set": "content",
  "pair": 8,
  "split": "held",
  "context": "Several GVSU students were looking forward to having a pleasant meal off campus at a nearby restaurant in Allendale. The students looked pleased when the waiter served their meals along with glasses of fresh-squeezed lemonade. Suddenly, one of the students stopped eating with a look of disgust. The student looked stunned as she inspected what appeared to be a white-winged moth.",
  "target": "A moth was in her salad.",
  "marked": "A moth was in her SALAD.",
  "focus": "SALAD",
  "foilFocus": "MOTH"
 },
 {
  "id": "focA-19",
  "set": "content",
  "pair": 9,
  "split": "dev",
  "context": "Sweethearts Steve and Sue were sharing a bag of candy while watching a late-night movie. An argument started in the middle of the movie about jelly beans. Sue said that orange jelly beans tasted funny.",
  "target": "Steve said, \"Orange jelly beans are the best kind.\"",
  "marked": "Steve said, \"Orange jelly beans are the BEST kind.\"",
  "focus": "BEST"
 },
 {
  "id": "focA-20",
  "set": "content",
  "pair": 9,
  "split": "dev",
  "context": "Sweethearts Steve and Sue were sharing a bag of candy while watching a late-night movie. An argument started in the middle of the movie about the best-tasting jelly beans. Sue said that green jelly beans are the best kind.",
  "target": "Steve said, \"Orange jelly beans are the best kind.\"",
  "marked": "Steve said, \"ORANGE jelly beans are the best kind.\"",
  "focus": "ORANGE"
 },
 {
  "id": "focA-21",
  "set": "content",
  "pair": 10,
  "split": "dev",
  "context": "John left work early to buy his wife a birthday present. John went to the local bookstore because his wife liked to read mystery novels. He picked out a mystery novel that was on the best-seller list. The storekeepers placed his purchase in a plain paper bag. As John entered his home, his wife asked what was in the brown paper bag. John wished to keep the mystery book a surprise.",
  "target": "John replied that he bought a book about birds.",
  "marked": "John replied that he bought a book about BIRDS.",
  "focus": "BIRDS"
 },
 {
  "id": "focA-22",
  "set": "content",
  "pair": 10,
  "split": "dev",
  "context": "The Hendersons recently hung a bird feeder in their backyard. Different birds frequented the feeder throughout the day. To be able to identify the birds, Mr. Henderson went to the library. He skimmed through the Audubon Society's collection of bird books. With the help of the glossy pictures, Mr. Henderson identified many of the birds native to region. Upon returning home, his wife asked if he had browsed the book collection on birds.",
  "target": "Mr. Henderson replied that he bought a book about birds.",
  "marked": "Mr. Henderson replied that he BOUGHT a book about birds.",
  "focus": "BOUGHT"
 },
 {
  "id": "focA-23",
  "set": "content",
  "pair": 11,
  "split": "held",
  "context": "Sixteen-year-old Ed sat down next to his father, who was reading the newspaper. Ed wanted to go to the movies with his friends later that evening. Within minutes of sitting down, Ed started to ask his father for something, but he mumbled his words. Ed's father anticipated his exact need.",
  "target": "Ed's father said, \"Do you need a dollar?\"",
  "marked": "Ed's father said, \"Do you need a DOLLAR?\"",
  "focus": "DOLLAR",
  "foilFocus": "NEED"
 },
 {
  "id": "focA-24",
  "set": "content",
  "pair": 11,
  "split": "held",
  "context": "Sixteen-year-old Ed drove to the floral shop to buy a small bouquet for his girlfriend. Ed picked out a beautiful arrangement of daisies and lavender. The store clerk rang up his purchase. Upon seeing the total due, Ed looked worried about the number of dollars in his pocket.",
  "target": "The next customer said, \"Do you need a dollar?\"",
  "marked": "The next customer said, \"Do you NEED a dollar?\"",
  "focus": "NEED",
  "foilFocus": "DOLLAR"
 },
 {
  "id": "focA-25",
  "set": "content",
  "pair": 12,
  "split": "dev",
  "context": "The VanBuren family had many pets. An aquarium filled with fish, a pet turtle, two cats, and one dog lived in the house. Unbeknownst to the family, their dog, Rover, liked to dig holes in the backyard. The next time the dog played in the yard, Rover dug a hole under the fence.",
  "target": "Rover escaped.",
  "marked": "Rover ESCAPED.",
  "focus": "ESCAPED"
 },
 {
  "id": "focA-26",
  "set": "content",
  "pair": 12,
  "split": "dev",
  "context": "The VanBuren family had many pets. An aquarium filled with fish, a pet turtle, two cats, and two dogs lived in the house. Unbeknownst to the family, the two dogs, Rover and Fido, liked to dig holes in the backyard. The next time the dogs played in the yard, one dog dug a hole under the fence, squirmed underneath, and ran away.",
  "target": "Rover escaped.",
  "marked": "ROVER escaped.",
  "focus": "ROVER",
  "foilFocus": "ESCAPED"
 },
 {
  "id": "focA-27",
  "set": "content",
  "pair": 13,
  "split": "dev",
  "context": "Sally met her best friend at the local coffee shop. After receiving their drinks, Sally and her friend located a quiet booth in the back of the coffee shop. Upon sitting down, Sally began to tell her friend about the latest gossip about Mark.",
  "target": "Sally exclaimed, \"Mark was arrested!\"",
  "marked": "Sally exclaimed, \"MARK was arrested!\"",
  "focus": "MARK"
 },
 {
  "id": "focA-28",
  "set": "content",
  "pair": 13,
  "split": "dev",
  "context": "Sally met her best friend at the local coffee shop. After receiving their drinks, Sally and her friend located a quiet booth in the back of the coffee shop. Upon sitting down, Sally's friend began to ask about the latest news regarding Mark.",
  "target": "Sally exclaimed, \"Mark was arrested!\"",
  "marked": "Sally exclaimed, \"Mark was ARRESTED!\"",
  "focus": "ARRESTED"
 },
 {
  "id": "focA-29",
  "set": "content",
  "pair": 14,
  "split": "held",
  "context": "One employee sat down in the break room at the jewelry store. His friend sat nearby. They both knew it was going to be a long day at work because the jewelry store was understaffed. Recent employee thefts had led to employee firings. That day, five employees were not at work because of stealing bracelets.",
  "target": "A fellow worker sighed, \"James stole a bracelet.\"",
  "marked": "A fellow worker sighed, \"JAMES stole a bracelet.\"",
  "focus": "JAMES"
 },
 {
  "id": "focA-30",
  "set": "content",
  "pair": 14,
  "split": "held",
  "context": "One employee sat down in the break room at the jewelry store. His friend sat nearby. They both knew it was going to be a long day at work because the jewelry store was understaffed. Recent employee thefts had led to employee firing. One of the workers asked why James was not at work.",
  "target": "A fellow worker sighed, \"James stole a bracelet.\"",
  "marked": "A fellow worker sighed, \"James stole a BRACELET.\"",
  "focus": "BRACELET"
 },
 {
  "id": "focA-31",
  "set": "content",
  "pair": 15,
  "split": "dev",
  "context": "Sue was browsing through Barnes & Noble, trying to come up with an idea of what to buy her brother-in-law John for his birthday party. An advertisement for the new best seller, The Da Vinci Code, caught her eye. She decided to call her sister to find out if John had already read this book. Her sister's response about John surprised her.",
  "target": "John was illiterate.",
  "marked": "John was ILLITERATE.",
  "focus": "ILLITERATE",
  "foilFocus": "JOHN"
 },
 {
  "id": "focA-32",
  "set": "content",
  "pair": 15,
  "split": "dev",
  "context": "Ms. Smith reviewed her students' performance on the standardized exams. Ms. Smith appreciated the opportunity to find out if each student in her class met the basic requirements. As she went through the graded exams, she was surprised at one very low reading score indicating illiteracy.",
  "target": "John was illiterate.",
  "marked": "JOHN was illiterate.",
  "focus": "JOHN",
  "foilFocus": "ILLITERATE"
 },
 {
  "id": "focA-33",
  "set": "content",
  "pair": 16,
  "split": "dev",
  "context": "An MSU student and a GVSU student were discussing the merits of university sports programs. The MSU student said that their athletic program was better because it is part of the Big Ten Conference. The GVSU student quickly retorted that the GVSU program was better because it is one of the top programs in NCAA Division II. The GVSU student sneered and continued to defend his university's athletes.",
  "target": "Our athletes graduate.",
  "marked": "Our athletes GRADUATE.",
  "focus": "GRADUATE",
  "foilFocus": "ATHLETES"
 },
 {
  "id": "focA-34",
  "set": "content",
  "pair": 16,
  "split": "dev",
  "context": "An MSU student and a GVSU student were discussing the merits of university sports programs. The MSU student said that their athletic program was better because it is part of the Big Ten Conference. The GVSU student quickly retorted that the GVSU program was better because it is one of the top programs in NCAA Division II. The GVSU student sneered and said that GVSU business majors, science majors, and humanities majors graduate.",
  "target": "Similarly, our athletes graduate.",
  "marked": "Similarly, our ATHLETES graduate.",
  "focus": "ATHLETES",
  "foilFocus": "GRADUATE"
 },
 {
  "id": "focA-35",
  "set": "content",
  "pair": 17,
  "split": "held",
  "context": "Billy's attendance at summer camp had been arranged and paid for by his neighborhood YMCA. The only requirements on Billy were to follow camp rules. Upon arrival, the young man had been told that several types of infractions could result in the loss of camping privileges and an early departure for home. All campers were urged to follow the rules posted on a sign near the cabins. Billy paid no attention to the rules, particularly the rules about proper etiquette inside the cabin.",
  "target": "He smoked in the cabin.",
  "marked": "He SMOKED in the cabin.",
  "focus": "SMOKED"
 },
 {
  "id": "focA-36",
  "set": "content",
  "pair": 17,
  "split": "held",
  "context": "Billy's attendance at summer camp had been arranged and paid for by his neighborhood YMCA. The only requirements on Billy were to follow camp rules. Upon arrival, the young man had been told that several types of infractions could result in the loss of camping privileges and an early departure for home. According to the signs posted on the cabins, smoking was not permitted in any of the buildings but was allowed outside. Having a nicotine craving, Billy picked up a cigarette and paid no attention to the rules about permissible areas to smoke.",
  "target": "He smoked in the cabin.",
  "marked": "He smoked IN the cabin.",
  "focus": "IN"
 },
 {
  "id": "focA-37",
  "set": "content",
  "pair": 18,
  "split": "dev",
  "context": "Susan and Sam went for a canoe ride. To their surprise, the river was turbulent. Susan stood up to change positions with the hope of stabilizing the canoe. As a result, the canoe rocked back and forth in the water and someone fell out.",
  "target": "Sam fell out of the canoe.",
  "marked": "SAM fell out of the canoe.",
  "focus": "SAM",
  "foilFocus": "FELL"
 },
 {
  "id": "focA-38",
  "set": "content",
  "pair": 18,
  "split": "dev",
  "context": "Susan and Sam went for a canoe ride. To their surprise, the river was turbulent and the canoe rocked back and forth in the water. With the hope of stabilizing the canoe, Sam stood up to change positions but lost his balance.",
  "target": "Sam fell out of the canoe.",
  "marked": "Sam FELL out of the canoe.",
  "focus": "FELL",
  "foilFocus": "SAM"
 },
 {
  "id": "focA-39",
  "set": "content",
  "pair": 19,
  "split": "dev",
  "context": "Ruth wanted to quickly clean the house before the company arrived for dinner. With her hands full of laundry, she tried to gather the cleaning supplies from around the house. Ruth found the bleach and a bucket. After searching everywhere, she called out to her husband.",
  "target": "\"Honey, do we have a mop?\"",
  "marked": "\"Honey, do we have a MOP?\"",
  "focus": "MOP"
 },
 {
  "id": "focA-40",
  "set": "content",
  "pair": 19,
  "split": "dev",
  "context": "Ruth wanted to quickly clean the house before the company arrived for dinner. With her hands full of laundry, she tried to gather the cleaning supplies from around the house. Ruth found the bleach and a bucket. She called out to her husband, after searching everywhere for something to mop the kitchen floors.",
  "target": "\"Honey, do we have a mop?\"",
  "marked": "\"Honey, do we HAVE a mop?\"",
  "focus": "HAVE"
 },
 {
  "id": "focB-01",
  "set": "function",
  "pair": 20,
  "split": "dev",
  "context": "John was at home alone watching TV. His wife, who had just arrived home, came up from behind him and saw he was watching an old rerun of his favorite TV show, Baywatch.",
  "target": "\"What are you doing?\" she asked.",
  "marked": "\"WHAT are you doing?\" she asked.",
  "focus": "WHAT",
  "foilFocus": "ARE"
 },
 {
  "id": "focB-02",
  "set": "function",
  "pair": 20,
  "split": "dev",
  "context": "John, the Baywatch fanatic, called up his little brother Tim on a Saturday night to see what he was up to. Tim replied sarcastically, \"Not sitting at home watching Baywatch.\"",
  "target": "\"Well, what are you doing, then?\" John asked.",
  "marked": "\"Well, what ARE you doing, then?\" John asked.",
  "focus": "ARE",
  "foilFocus": "WHAT"
 },
 {
  "id": "focB-03",
  "set": "function",
  "pair": 21,
  "split": "dev",
  "context": "The babysitter just arrived to the family home and was receiving instructions for the evening. The sitter was furnished with an emergency contact number, food preferences, and bedtime routines. The babysitter was warned that the twins will sneak out of their beds to play. The parents were expected to be home by 9 p.m.",
  "target": "Before they return home, the twins should be in bed.",
  "marked": "Before they return home, the twins should be IN bed.",
  "focus": "IN",
  "foilFocus": "THEY"
 },
 {
  "id": "focB-04",
  "set": "function",
  "pair": 21,
  "split": "dev",
  "context": "The babysitter just arrived to the family home and was receiving instructions for the evening. The sitter was furnished with an emergency contact number, food preferences, and bedtime routines. The babysitter was told that the twins' father will return home before their mother. The twins' father disapproves when the twins do not stay in bed.",
  "target": "Before he returns home, the twins should be in bed.",
  "marked": "Before he returns home, the twins should be IN bed.",
  "focus": "IN",
  "foilFocus": "HE"
 },
 {
  "id": "focB-05",
  "set": "function",
  "pair": 22,
  "split": "held",
  "context": "Mrs. Woodward proudly showed off her still-warm, homemade peanut butter cookies. Their aroma filled the kitchen. In recognition of her neighbor's recent promotion at work, Mrs. Woodward offered Stan the basket of cookies.",
  "target": "\"I only want a cookie,\" replied Stan.",
  "marked": "\"I only want A cookie,\" replied Stan.",
  "focus": "A",
  "foilFocus": "I"
 },
 {
  "id": "focB-06",
  "set": "function",
  "pair": 22,
  "split": "held",
  "context": "Mrs. Woodward proudly showed off her still-warm, homemade peanut butter cookies. Their aroma filled the kitchen. In recognition of her neighbor's recent engagement, Mrs. Woodward offered a cookie to the happy couple, Stan and Sue.",
  "target": "\"She wants a cookie,\" replied Stan.",
  "marked": "\"SHE wants a cookie,\" replied Stan.",
  "focus": "SHE",
  "foilFocus": "A"
 },
 {
  "id": "focB-07",
  "set": "function",
  "pair": 23,
  "split": "dev",
  "context": "Kim rushed back to her dorm after class. As she walked in, she tripped on something. Kim picked up a book from the floor. She asked her roommate, \"Did you read that book for a class?\"",
  "target": "\"No, I read this book.\"",
  "marked": "\"No, I read THIS book.\"",
  "focus": "THIS",
  "foilFocus": "I"
 },
 {
  "id": "focB-08",
  "set": "function",
  "pair": 23,
  "split": "dev",
  "context": "Tim and his best friend were reading at the library. Books were scattered on the table. There was one book on the floor, The Great Gatsby. The librarian picked it up and asked, \"Which of you read this book?\"",
  "target": "\"I read this book,\" Tim said.",
  "marked": "\"I read this book,\" Tim said.",
  "focus": "I",
  "foilFocus": "THIS"
 },
 {
  "id": "focB-09",
  "set": "function",
  "pair": 24,
  "split": "dev",
  "context": "A new member of the book club was asking a few questions. She wondered if the ladies had read The Catcher in the Rye. While shaking their heads no, the ladies pointed down to a novel among a stack of books on the table.",
  "target": "\"We read that book.\"",
  "marked": "\"We read THAT book.\"",
  "focus": "THAT",
  "foilFocus": "WE"
 },
 {
  "id": "focB-10",
  "set": "function",
  "pair": 24,
  "split": "dev",
  "context": "To fit in, the new member of the book club tried to mingle. The new member asked the elderly woman sitting beside her if she had read The Catcher in the Rye. The elderly woman leaned over, whispered, and pointed across the room to the lady wearing a pink dress.",
  "target": "\"She read that book.\"",
  "marked": "\"SHE read that book.\"",
  "focus": "SHE",
  "foilFocus": "THAT"
 },
 {
  "id": "focB-11",
  "set": "function",
  "pair": 25,
  "split": "held",
  "context": "John was aimlessly driving around looking for some relief for his bad toothache. His friend in the car suggested purchasing a numbing gel sold at most drugstores. John wondered if the nearest drugstore was to the east.",
  "target": "\"It is that way,\" directed his friend.",
  "marked": "\"It is THAT way,\" directed his friend.",
  "focus": "THAT",
  "foilFocus": "IT"
 },
 {
  "id": "focB-12",
  "set": "function",
  "pair": 25,
  "split": "held",
  "context": "John had woken up with a toothache. His roommate noticed that John seemed sleepy, confused, and in considerable pain. John's roommate said the best solution was a numbing gel.",
  "target": "\"That was it,\" said a relieved John.",
  "marked": "\"That was IT,\" said a relieved John.",
  "focus": "IT",
  "foilFocus": "THAT"
 },
 {
  "id": "focB-13",
  "set": "function",
  "pair": 26,
  "split": "dev",
  "context": "Jack was assembling a model car with his son for the first time. His son picked up a piece and asked, \"Where does this go?\"",
  "target": "\"This goes here,\" Jack replied, pointing to the model Cadillac.",
  "marked": "\"This goes HERE,\" Jack replied, pointing to the model Cadillac.",
  "focus": "HERE",
  "foilFocus": "THIS"
 },
 {
  "id": "focB-14",
  "set": "function",
  "pair": 26,
  "split": "dev",
  "context": "Todd was over at his friend Jack's house admiring the collection of handcrafted model cars. Todd pointed to an empty glass case and asked, \"What goes here?\"",
  "target": "\"This goes here,\" Jack replied, pointing to the model Cadillac.",
  "marked": "\"THIS goes here,\" Jack replied, pointing to the model Cadillac.",
  "focus": "THIS",
  "foilFocus": "HERE"
 },
 {
  "id": "focB-15",
  "set": "function",
  "pair": 27,
  "split": "dev",
  "context": "Sara was eating lunch at a restaurant with her little son Ryan. Ryan was sitting with his food in front of him, pushing his peas around. Sara told him to eat his peas.",
  "target": "\"I am,\" Ryan replied.",
  "marked": "\"I AM,\" Ryan replied.",
  "focus": "AM",
  "foilFocus": "I"
 },
 {
  "id": "focB-16",
  "set": "function",
  "pair": 27,
  "split": "dev",
  "context": "Ryan was treating his employees Nate and Larry to lunch at a fancy restaurant. After a very delicious meal, the waitress came to the table with the bill. She asked, \"Who is paying?\"",
  "target": "\"I am,\" Ryan replied.",
  "marked": "\"I am,\" Ryan replied.",
  "focus": "I",
  "foilFocus": "AM"
 },
 {
  "id": "focB-17",
  "set": "function",
  "pair": 28,
  "split": "held",
  "context": "Kyle was on trial for robbing the First United Bank of Grand Rapids. The lawyer was questioning the witness. The lawyer asked, \"Who is the culprit?\"",
  "target": "\"He is,\" the witness said, pointing across the room to Kyle.",
  "marked": "\"HE is,\" the witness said, pointing across the room to Kyle.",
  "focus": "HE",
  "foilFocus": "IS"
 },
 {
  "id": "focB-18",
  "set": "function",
  "pair": 28,
  "split": "held",
  "context": "Kyle was on trial for robbing the First United Bank of Grand Rapids. Earlier in the trial, Kyle testified that he was innocent. The lawyer asked the witness on the stand if Kyle was a liar.",
  "target": "\"He is,\" the witness said as he pointed across the room to Kyle.",
  "marked": "\"He IS,\" the witness said as he pointed across the room to Kyle.",
  "focus": "IS",
  "foilFocus": "HE"
 },
 {
  "id": "focB-19",
  "set": "function",
  "pair": 29,
  "split": "dev",
  "context": "Adam was working his first day as a security guard. One of his responsibilities was to turn on the alarm system at night. He asked his boss, \"Should I turn the alarm on before I leave?\"",
  "target": "\"Do it as you leave,\" his boss replied.",
  "marked": "\"Do it AS you leave,\" his boss replied.",
  "focus": "AS",
  "foilFocus": "YOU"
 },
 {
  "id": "focB-20",
  "set": "function",
  "pair": 29,
  "split": "dev",
  "context": "Adam was working his first shift as a night watchman for the mall. His boss always left work first, and it was Adam's responsibility to turn on the alarm. He asked a coworker, \"Should I turn the alarm on when the boss leaves?\"",
  "target": "\"No, do it as you leave,\" he replied.",
  "marked": "\"No, do it as YOU leave,\" he replied.",
  "focus": "YOU",
  "foilFocus": "AS"
 },
 {
  "id": "focB-21",
  "set": "function",
  "pair": 30,
  "split": "dev",
  "context": "The Smith family went to the beach. Everyone was in the water except Brian. Someone asked if Brian could swim.",
  "target": "He can.",
  "marked": "He CAN.",
  "focus": "CAN",
  "foilFocus": "HE"
 },
 {
  "id": "focB-22",
  "set": "function",
  "pair": 30,
  "split": "dev",
  "context": "Sara and Brian went to the beach with a friend. The lake looked so inviting. The friend asked, \"Can either of you swim?\"",
  "target": "\"He can.\"",
  "marked": "\"HE can.\"",
  "focus": "HE",
  "foilFocus": "CAN"
 },
 {
  "id": "focB-23",
  "set": "function",
  "pair": 31,
  "split": "held",
  "context": "Charlie went over to Megan's apartment to see her new hamster, Winnie. She brought out Winnie's cage and then left the room to answer the phone. When she returned, Charlie looked frantic and the cage was empty.",
  "target": "\"Where is my hamster?\" Megan asked.",
  "marked": "\"WHERE is my hamster?\" Megan asked.",
  "focus": "WHERE",
  "foilFocus": "MY"
 },
 {
  "id": "focB-24",
  "set": "function",
  "pair": 31,
  "split": "held",
  "context": "Little Megan went away to summer camp. While Megan was away, her hamster Winnie died and her parents replaced it with a similar one, hoping Megan would not notice the switch. When Megan returned from camp, she ran into her room and looked at somebody else's hamster in the cage.",
  "target": "\"Where is my hamster?\" Megan asked.",
  "marked": "\"Where is MY hamster?\" Megan asked.",
  "focus": "MY",
  "foilFocus": "WHERE"
 }
];
module.exports = { FOCUS_ITEMS };
