require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================================
// 1. MASSIVE STATIC QUESTION POOL (150 Questions - 25 Per Category)
// =====================================================================
const questionsDB = {
    "TechAI": [
        {"text":"When your computer freezes, what is your first reaction?","options":[{"text":"Troubleshoot and fix it myself.","tags":{"Technical":3,"ProblemSolving":2}},{"text":"Search Google/YouTube for a fix.","tags":{"Analytical":2,"Resourceful":3}},{"text":"Ask a friend who is good with tech.","tags":{"Communication":2}},{"text":"Restart it and hope for the best.","tags":{"Easygoing":1}}]},
        {"text":"What excites you most about AI?","options":[{"text":"How it processes massive data.","tags":{"Analytical":3}},{"text":"How it can generate art/music.","tags":{"Creative":3}},{"text":"How it can help people in daily life.","tags":{"Empathy":3}},{"text":"How it automates boring tasks.","tags":{"Logical":3}}]},
        {"text":"How do you handle a messy folder of files?","options":[{"text":"Write a script to organize them.","tags":{"Technical":3,"ProblemSolving":3}},{"text":"Manually sort into perfect folders.","tags":{"Organized":3}},{"text":"Only search for what I need.","tags":{"Practical":2}},{"text":"Leave it messy, I know where things are.","tags":{"Adaptable":2}}]},
        {"text":"If you could invent one thing, it would be:","options":[{"text":"A new coding language.","tags":{"Technical":3,"Analytical":2}},{"text":"A robot that cleans the house.","tags":{"Practical":3}},{"text":"A new musical instrument.","tags":{"Creative":3}},{"text":"An app to connect lonely people.","tags":{"Empathy":3}}]},
        {"text":"What is your approach to password security?","options":[{"text":"Use a password manager with complex hashes.","tags":{"Technical":3,"Organized":2}},{"text":"Use a memorable phrase with numbers.","tags":{"Practical":3}},{"text":"Use the same password for everything.","tags":{"Easygoing":1}},{"text":"Write them down in a physical notebook.","tags":{"Organized":2}}]},
        {"text":"When learning a complex idea, you:","options":[{"text":"Ask about the specific mechanics.","tags":{"Analytical":3}},{"text":"Imagine it visually.","tags":{"Creative":2}},{"text":"Relate it to people.","tags":{"Empathy":3}},{"text":"Write bullet points.","tags":{"Organized":3}}]},
        {"text":"What type of puzzles do you enjoy most?","options":[{"text":"Logic/math puzzles (Sudoku).","tags":{"Analytical":3,"ProblemSolving":2}},{"text":"Word puzzles (Crosswords).","tags":{"Communication":2}},{"text":"Visual puzzles (Jigsaw).","tags":{"Creative":2}},{"text":"Real-world challenges.","tags":{"Practical":3}}]},
        {"text":"If you ran a tech company, you would be the:","options":[{"text":"Lead Developer writing the best code.","tags":{"Technical":3}},{"text":"CEO pitching the vision to investors.","tags":{"Leadership":3}},{"text":"Lead Designer making the UI beautiful.","tags":{"Creative":3}},{"text":"Project Manager keeping everyone on track.","tags":{"Organized":3}}]},
        {"text":"What do you notice first about a new app?","options":[{"text":"How fast and smooth it runs.","tags":{"Technical":3}},{"text":"How cool the layout looks.","tags":{"Creative":3}},{"text":"How easy it is to understand.","tags":{"Empathy":2}},{"text":"The privacy settings.","tags":{"Analytical":3}}]},
        {"text":"Which part of building a website sounds most fun?","options":[{"text":"Writing the backend code.","tags":{"Technical":3,"Analytical":2}},{"text":"Designing the logo and colors.","tags":{"Creative":3}},{"text":"Writing the text and articles.","tags":{"Communication":3}},{"text":"Planning how pages link together.","tags":{"Organized":3}}]},
        {"text":"How do you prefer to learn something new?","options":[{"text":"Taking it apart to see how it works.","tags":{"Analytical":3,"Technical":2}},{"text":"Watching a visual tutorial.","tags":{"Creative":2}},{"text":"Reading the official manual.","tags":{"Organized":2}},{"text":"Practicing with a group.","tags":{"Communication":3}}]},
        {"text":"Your perfect work environment is:","options":[{"text":"Quiet room with dual monitors.","tags":{"Technical":3,"Independent":2}},{"text":"Lively office sharing ideas.","tags":{"Communication":3,"Creative":1}},{"text":"A highly organized desk.","tags":{"Organized":3}},{"text":"Flexible space to move around.","tags":{"Adaptable":3}}]},
        {"text":"If you had to read a book right now, it would be:","options":[{"text":"Sci-fi or future technology.","tags":{"Imaginative":3,"Technical":2}},{"text":"A biography of a leader.","tags":{"Leadership":3}},{"text":"A mystery novel.","tags":{"Analytical":3}},{"text":"A how-to guide.","tags":{"Practical":3}}]},
        {"text":"You find a bug in a video game. You:","options":[{"text":"Try to replicate it to see why it happens.","tags":{"Analytical":3,"ProblemSolving":2}},{"text":"Use it to your advantage to win.","tags":{"Logical":3}},{"text":"Report it to the developers.","tags":{"Organized":2}},{"text":"Ignore it and keep playing.","tags":{"Easygoing":2}}]},
        {"text":"What is your favorite subject in school?","options":[{"text":"Computer Science / IT.","tags":{"Technical":3}},{"text":"Math / Physics.","tags":{"Analytical":3}},{"text":"Art / Graphic Design.","tags":{"Creative":3}},{"text":"History / English.","tags":{"Communication":2}}]},
        {"text":"When buying a laptop, you look for:","options":[{"text":"RAM, Processor speed, and OS.","tags":{"Technical":3}},{"text":"Screen resolution and color accuracy.","tags":{"Creative":3}},{"text":"The cheapest one that works.","tags":{"Practical":3}},{"text":"The one all my friends have.","tags":{"Social":2}}]},
        {"text":"How do you feel about coding?","options":[{"text":"I love the logic and problem solving.","tags":{"Technical":3,"Analytical":3}},{"text":"It's a useful tool to build my designs.","tags":{"Creative":2,"Practical":2}},{"text":"It seems boring and too complex.","tags":{"Social":2}},{"text":"I prefer dealing with hardware over software.","tags":{"Technical":2}}]},
        {"text":"When a group project requires a presentation, you:","options":[{"text":"Format the slides to look perfect.","tags":{"Creative":3}},{"text":"Organize the data and research.","tags":{"Analytical":3}},{"text":"Do the actual speaking.","tags":{"Communication":3}},{"text":"Manage the timeline.","tags":{"Organized":3}}]},
        {"text":"If you could master any skill instantly, it would be:","options":[{"text":"Hacking/Cybersecurity.","tags":{"Technical":3,"Analytical":2}},{"text":"Digital Animation.","tags":{"Creative":3}},{"text":"Public Speaking.","tags":{"Communication":3}},{"text":"Advanced Mathematics.","tags":{"Logical":3}}]},
        {"text":"How do you stay updated on news?","options":[{"text":"Tech blogs and forums like Reddit.","tags":{"Technical":3}},{"text":"Social media feeds.","tags":{"Social":3}},{"text":"Traditional news websites.","tags":{"Organized":2}},{"text":"I don't really follow the news.","tags":{"Independent":2}}]},
        {"text":"When setting up a smart home device, you:","options":[{"text":"Integrate it perfectly with my network.","tags":{"Technical":3}},{"text":"Just want it to play music and turn on lights.","tags":{"Practical":3}},{"text":"Worry about it recording my data.","tags":{"Analytical":3}},{"text":"Make it change colors based on my mood.","tags":{"Creative":3}}]},
        {"text":"Which of these sounds most tedious to you?","options":[{"text":"Writing documentation for code.","tags":{"Technical":1,"Creative":3}},{"text":"Debugging a small syntax error.","tags":{"Logical":2}},{"text":"Drawing the same frame 100 times.","tags":{"Analytical":3}},{"text":"Talking to angry customers.","tags":{"Independent":3}}]},
        {"text":"How do you explain Wi-Fi to a child?","options":[{"text":"'Invisible waves that carry internet.'","tags":{"Communication":3,"Creative":2}},{"text":"'Radio frequencies transmitting data.'","tags":{"Technical":3}},{"text":"'Magic that makes YouTube work.'","tags":{"Empathy":2}},{"text":"I wouldn't know how to simplify it.","tags":{"Analytical":2}}]},
        {"text":"What is your favorite part of a video game?","options":[{"text":"The core gameplay mechanics and loops.","tags":{"Analytical":3}},{"text":"The graphics and soundtrack.","tags":{"Creative":3}},{"text":"The storyline and character dialogue.","tags":{"Empathy":2}},{"text":"Playing with my friends online.","tags":{"Social":3}}]},
        {"text":"How do you feel about open-source software?","options":[{"text":"Love it, I want to contribute to the code.","tags":{"Technical":3,"Collaborative":2}},{"text":"It's great because it's free.","tags":{"Practical":3}},{"text":"I prefer polished, paid software.","tags":{"Organized":2}},{"text":"I don't know what that means.","tags":{"Easygoing":1}}]}
    ],
    "ArtMusic": [
        {"text":"When listening to a new song, what grabs your attention first?","options":[{"text":"The lyrical storytelling and emotion.","tags":{"Empathy":3,"Communication":2}},{"text":"The underlying beat and rhythm.","tags":{"Creative":3,"Auditory":3}},{"text":"The technical production and mixing.","tags":{"Analytical":2,"Technical":3}},{"text":"How well I can dance to it.","tags":{"Expressive":3,"Practical":1}}]},
        {"text":"Faced with a blank canvas (or page), you feel:","options":[{"text":"Excited to let my imagination run wild.","tags":{"Imaginative":3,"Creative":3}},{"text":"Anxious until I outline a solid plan.","tags":{"Organized":3,"Analytical":2}},{"text":"Inspired to express a deep personal feeling.","tags":{"Expressive":3,"Empathy":2}},{"text":"Ready to experiment with new tools/brushes.","tags":{"Technical":3,"ProblemSolving":2}}]},
        {"text":"How do you prefer to practice your craft?","options":[{"text":"Jamming or collaborating with others.","tags":{"Social":3,"Communication":3}},{"text":"Isolating myself until it's perfect.","tags":{"Independent":3,"Dedicated":2}},{"text":"Studying the masters and analyzing their work.","tags":{"Analytical":3,"Organized":2}},{"text":"Performing live and feeding off the crowd.","tags":{"Expressive":3,"Leadership":2}}]},
        {"text":"At an art museum, you spend the most time:","options":[{"text":"Looking closely at brushstrokes and techniques.","tags":{"Technical":3,"Visual":3}},{"text":"Reading the history behind the pieces.","tags":{"Analytical":3,"Communication":2}},{"text":"Soaking in the overall mood of the room.","tags":{"Empathy":3,"Creative":2}},{"text":"Looking for interactive or modern exhibits.","tags":{"Practical":2,"Imaginative":3}}]},
        {"text":"If you were to score a film, it would be:","options":[{"text":"A sweeping, emotional orchestral piece.","tags":{"Creative":3,"Empathy":3}},{"text":"A gritty, electronic synthwave track.","tags":{"Technical":3,"Expressive":2}},{"text":"A catchy pop soundtrack.","tags":{"Social":3,"Communication":2}},{"text":"A minimalist, experimental soundscape.","tags":{"Analytical":3,"Imaginative":3}}]},
        {"text":"What is your relationship with criticism?","options":[{"text":"I use it to technically improve my skills.","tags":{"Analytical":3,"Dedicated":3}},{"text":"It hurts, my work is very personal to me.","tags":{"Sensitive":3,"Expressive":2}},{"text":"I debate it if I think my vision was right.","tags":{"Communication":3,"Leadership":2}},{"text":"I ignore it and keep making what I love.","tags":{"Independent":3,"Creative":2}}]},
        {"text":"When designing a poster, what matters most?","options":[{"text":"The typography and alignment.","tags":{"Organized":3,"Technical":2}},{"text":"The striking use of color.","tags":{"Visual":3,"Creative":3}},{"text":"The message it conveys to the audience.","tags":{"Communication":3,"Empathy":2}},{"text":"Getting it done quickly and efficiently.","tags":{"Practical":3}}]},
        {"text":"Your ideal creative workspace is:","options":[{"text":"A messy studio filled with paints and instruments.","tags":{"Creative":3,"Expressive":3}},{"text":"A clean, minimalist desk with a high-end monitor.","tags":{"Organized":3,"Technical":3}},{"text":"A bustling coffee shop.","tags":{"Social":3,"Adaptable":2}},{"text":"Outdoors in nature.","tags":{"Nature":3,"Imaginative":2}}]},
        {"text":"In a coffee shop, you notice first:","options":[{"text":"Furniture, lighting, and wall art.","tags":{"Creative":3,"Visual":3}},{"text":"The background music.","tags":{"Creative":2,"Auditory":3}},{"text":"How fast the line moves.","tags":{"Analytical":2,"Organized":2}},{"text":"The vibe of the people.","tags":{"Empathy":3}}]},
        {"text":"Bored in class, you are likely:","options":[{"text":"Doodling in the margins.","tags":{"Creative":3,"Visual":2}},{"text":"Writing a story or poem.","tags":{"Creative":2,"Communication":3}},{"text":"Daydreaming big ideas.","tags":{"Imaginative":3}},{"text":"Reading ahead.","tags":{"Analytical":3}}]},
        {"text":"Deciding what clothes to wear:","options":[{"text":"Mixing colors and styles.","tags":{"Creative":3,"Expressive":3}},{"text":"Whatever is comfortable.","tags":{"Practical":3}},{"text":"Following current trends.","tags":{"Social":2}},{"text":"Grabbing the first clean thing.","tags":{"Easygoing":2}}]},
        {"text":"When buying a product, you choose based on:","options":[{"text":"Beautiful packaging and design.","tags":{"Creative":3}},{"text":"Best features and specs.","tags":{"Analytical":3,"Technical":2}},{"text":"The cheapest option.","tags":{"Practical":3}},{"text":"Friend recommendations.","tags":{"Communication":2}}]},
        {"text":"Favorite way to express feelings:","options":[{"text":"Drawing, painting, or designing.","tags":{"Creative":3}},{"text":"Writing or talking.","tags":{"Communication":3}},{"text":"Music or acting.","tags":{"Expressive":3}},{"text":"Processing quietly alone.","tags":{"Independent":2}}]},
        {"text":"Which software to master?","options":[{"text":"Adobe Photoshop/Illustrator.","tags":{"Creative":3,"Technical":2}},{"text":"Microsoft Excel.","tags":{"Analytical":3,"Organized":2}},{"text":"Video editing (Premiere).","tags":{"Creative":2,"Technical":2}},{"text":"I don't like complex software.","tags":{"Practical":2}}]},
        {"text":"On a blank billboard, you put:","options":[{"text":"Original artwork.","tags":{"Creative":3}},{"text":"A clever, funny quote.","tags":{"Communication":3,"Empathy":2}},{"text":"A business ad.","tags":{"Logical":2,"Leadership":2}},{"text":"A confusing puzzle.","tags":{"Analytical":3}}]},
        {"text":"When you take a photo, what is most important?","options":[{"text":"The composition and lighting.","tags":{"Creative":3,"Visual":3}},{"text":"Capturing a genuine emotion.","tags":{"Empathy":3,"Expressive":2}},{"text":"Making sure everyone is in frame.","tags":{"Organized":2}},{"text":"I prefer taking videos over photos.","tags":{"Technical":2}}]},
        {"text":"If you redesign your bedroom, you start with:","options":[{"text":"Picking a specific color palette and theme.","tags":{"Creative":3,"Organized":2}},{"text":"Moving furniture for better space and flow.","tags":{"Analytical":2,"Practical":3}},{"text":"Hanging up posters of things I love.","tags":{"Expressive":3}},{"text":"I don't care what my room looks like.","tags":{"Easygoing":3}}]},
        {"text":"What kind of YouTube videos do you binge?","options":[{"text":"Video essays on movies, art, or game design.","tags":{"Analytical":2,"Creative":3}},{"text":"Vlogs and lifestyle content.","tags":{"Social":3}},{"text":"Tech reviews and unboxings.","tags":{"Technical":3}},{"text":"Comedy and sketch shows.","tags":{"Communication":2,"Expressive":2}}]},
        {"text":"If you were a character in a movie, you'd be:","options":[{"text":"The visionary director behind the camera.","tags":{"Leadership":2,"Creative":3}},{"text":"The charismatic lead actor.","tags":{"Expressive":3,"Communication":3}},{"text":"The writer who created the whole universe.","tags":{"Imaginative":3}},{"text":"The brilliant hacker sidekick.","tags":{"Technical":3}}]},
        {"text":"How do you feel about modern abstract art?","options":[{"text":"I love interpreting the hidden meanings.","tags":{"Creative":3,"Analytical":2}},{"text":"I appreciate the colors, even if it's weird.","tags":{"Visual":3}},{"text":"I think it's mostly a scam. Anyone could paint that.","tags":{"Logical":3,"Practical":2}},{"text":"It's okay, but I prefer realistic drawings.","tags":{"Organized":2}}]},
        {"text":"When writing an essay, you spend the most time:","options":[{"text":"Finding the perfect descriptive words.","tags":{"Communication":3,"Creative":2}},{"text":"Making sure the formatting and citations are flawless.","tags":{"Organized":3}},{"text":"Structuring a bulletproof argument.","tags":{"Analytical":3,"Logical":2}},{"text":"Procrastinating until the night before.","tags":{"Adaptable":2}}]},
        {"text":"What is your relationship with social media?","options":[{"text":"I carefully curate my grid to look aesthetic.","tags":{"Creative":3,"Visual":3}},{"text":"I use it to chat and stay connected.","tags":{"Social":3,"Communication":2}},{"text":"I mainly lurk and consume information.","tags":{"Analytical":2}},{"text":"I rarely use it. I prefer real life.","tags":{"Independent":3}}]},
        {"text":"If you had to learn an instrument, it would be:","options":[{"text":"Piano (complex and versatile).","tags":{"Analytical":3,"Creative":2}},{"text":"Electric Guitar (loud and expressive).","tags":{"Expressive":3}},{"text":"Drums (rhythm and energy).","tags":{"Practical":3}},{"text":"Synthesizer (electronic and technical).","tags":{"Technical":3}}]},
        {"text":"How do you sketch or draw?","options":[{"text":"Freehand, letting my imagination guide me.","tags":{"Creative":3,"Imaginative":3}},{"text":"With a ruler, measuring perfect perspective.","tags":{"Organized":3,"Analytical":2}},{"text":"I can only draw stick figures.","tags":{"Practical":2}},{"text":"I trace or copy things I see.","tags":{"Visual":2}}]},
        {"text":"When watching an animated movie, you think about:","options":[{"text":"How many hours it took to render the lighting.","tags":{"Technical":3,"Creative":2}},{"text":"The character design and color choices.","tags":{"Creative":3,"Visual":3}},{"text":"The vocal performances of the actors.","tags":{"Expressive":3}},{"text":"Just enjoying the plot.","tags":{"Easygoing":3}}]}
    ],
    "Healthcare": [
        {"text":"A stranger suddenly faints in a public place. You:","options":[{"text":"Immediately check their pulse and breathing.","tags":{"Practical":3,"ProblemSolving":3}},{"text":"Comfort the people around them and call 911.","tags":{"Empathy":3,"Communication":3}},{"text":"Organize the crowd to give the person space.","tags":{"Leadership":3,"Organized":2}},{"text":"Panic slightly, but try to find a doctor.","tags":{"Sensitive":2,"Resourceful":3}}]},
        {"text":"What aspect of the human body fascinates you most?","options":[{"text":"How the brain processes thoughts and trauma.","tags":{"Psychology":3,"Empathy":2}},{"text":"The mechanics of bones, muscles, and surgery.","tags":{"Technical":3,"Analytical":2}},{"text":"How cells fight off viruses and diseases.","tags":{"Logical":3,"Analytical":3}},{"text":"Diet, nutrition, and holistic wellness.","tags":{"Nature":3,"Practical":3}}]},
        {"text":"How do you deliver difficult news to a friend?","options":[{"text":"With deep empathy, holding their hand.","tags":{"Empathy":3,"Emotional":3}},{"text":"Directly and clearly, offering immediate solutions.","tags":{"Logical":3,"ProblemSolving":2}},{"text":"I try to have someone else do it, I hate conflict.","tags":{"Reserved":3}},{"text":"I carefully script what I'm going to say first.","tags":{"Organized":3,"Communication":2}}]},
        {"text":"Working a 12-hour night shift sounds:","options":[{"text":"Exhausting, but worth it to save lives.","tags":{"Dedicated":3,"Empathy":3}},{"text":"Great, I love the quiet focus of the night.","tags":{"Independent":3,"Analytical":2}},{"text":"Terrible, I need a strict sleep schedule.","tags":{"Organized":3,"Practical":2}},{"text":"Exciting, I thrive on adrenaline and coffee.","tags":{"Adaptable":3,"ProblemSolving":2}}]},
        {"text":"In a hospital setting, you would rather be:","options":[{"text":"The surgeon performing a high-stakes operation.","tags":{"Technical":3,"Leadership":3}},{"text":"The nurse providing daily care and comfort.","tags":{"Empathy":3,"Dedicated":3}},{"text":"The lab technician analyzing blood samples.","tags":{"Analytical":3,"Independent":3}},{"text":"The administrator managing hospital efficiency.","tags":{"Organized":3,"Logical":2}}]},
        {"text":"How do you feel about continuous, lifelong learning?","options":[{"text":"I love reading the latest medical journals.","tags":{"Analytical":3,"Logical":2}},{"text":"I enjoy learning if it directly helps my patients.","tags":{"Empathy":3,"Practical":3}},{"text":"I prefer to master one skill and stick to it.","tags":{"Dedicated":2,"Organized":2}},{"text":"I like learning through hands-on practice.","tags":{"Technical":3,"Adaptable":2}}]},
        {"text":"When someone is dealing with a chronic illness, you:","options":[{"text":"Research alternative treatments and clinical trials.","tags":{"Analytical":3,"Resourceful":3}},{"text":"Check in on their mental health regularly.","tags":{"Psychology":3,"Empathy":3}},{"text":"Cook them meals and help with daily chores.","tags":{"Practical":3,"Dedicated":2}},{"text":"Help them organize their medications and appointments.","tags":{"Organized":3}}]},
        {"text":"How do you handle gross sights (blood, wounds)?","options":[{"text":"I have a strong stomach, it doesn't bother me.","tags":{"Practical":3,"Dedicated":3}},{"text":"I view it purely clinically and scientifically.","tags":{"Analytical":3,"Logical":3}},{"text":"I feel woozy but I push through it.","tags":{"Adaptable":2}},{"text":"I absolutely cannot handle it.","tags":{"Sensitive":3}}]},
        {"text":"A friend is bleeding. You:","options":[{"text":"Stay calm, clean and bandage it.","tags":{"Practical":3,"ProblemSolving":2}},{"text":"Comfort them so they aren't scared.","tags":{"Empathy":3}},{"text":"Faint or look away.","tags":{"Sensitive":3}},{"text":"Call someone who knows what to do.","tags":{"Communication":2}}]},
        {"text":"How do you feel about daily routines?","options":[{"text":"Love having a strict schedule.","tags":{"Organized":3}},{"text":"Like them, but need flexibility.","tags":{"Adaptable":2}},{"text":"Thrive when every day is different.","tags":{"Adaptable":3,"ProblemSolving":2}},{"text":"Hate routines, prefer to wing it.","tags":{"Creative":2}}]},
        {"text":"When a friend has a problem, you:","options":[{"text":"Listen quietly and offer a shoulder.","tags":{"Empathy":3}},{"text":"Offer solutions to fix it.","tags":{"ProblemSolving":3,"Logical":2}},{"text":"Try to distract them with fun.","tags":{"Creative":2,"Social":2}},{"text":"Help them analyze why it happened.","tags":{"Analytical":3}}]},
        {"text":"Working under extreme pressure:","options":[{"text":"I stay highly focused and act quickly.","tags":{"ProblemSolving":3,"Leadership":2}},{"text":"I get anxious but push through.","tags":{"Dedicated":3}},{"text":"I need to step back and breathe.","tags":{"Analytical":2}},{"text":"I prefer low-stress environments.","tags":{"Creative":2}}]},
        {"text":"Comfortable talking to strangers?","options":[{"text":"Yes, I love making people feel heard.","tags":{"Empathy":3,"Communication":3}},{"text":"Only if I have a reason to.","tags":{"Logical":2,"Practical":2}},{"text":"Can do it, but it drains me.","tags":{"Independent":2}},{"text":"No, I am very shy.","tags":{"Reserved":2}}]},
        {"text":"If you see a stray animal on the street, you:","options":[{"text":"Try to catch it and take it to a vet/shelter.","tags":{"Empathy":3,"Nature":3}},{"text":"Call animal control to handle it safely.","tags":{"Organized":2,"Logical":2}},{"text":"Feel sad but keep walking.","tags":{"Sensitive":2}},{"text":"Try to feed it from a distance.","tags":{"Practical":2}}]},
        {"text":"What is your approach to eating healthy?","options":[{"text":"I track my macros and calories in an app.","tags":{"Analytical":3,"Organized":3}},{"text":"I eat intuitively based on how my body feels.","tags":{"Empathy":2,"Adaptable":2}},{"text":"I love cooking fresh, organic meals from scratch.","tags":{"Creative":3,"Nature":2}},{"text":"I eat whatever tastes good and is cheap.","tags":{"Practical":3}}]},
        {"text":"When someone is grieving, the best thing to do is:","options":[{"text":"Sit with them in silence and hold their hand.","tags":{"Empathy":3,"Emotional":3}},{"text":"Cook them meals and clean their house.","tags":{"Practical":3,"Dedicated":2}},{"text":"Give them space to process it alone.","tags":{"Independent":2}},{"text":"Recommend a good therapist.","tags":{"Analytical":2,"Logical":2}}]},
        {"text":"How is your memory for small details?","options":[{"text":"Excellent, I remember allergies and birthdays.","tags":{"Empathy":3,"Organized":3}},{"text":"Good for facts and numbers, bad for names.","tags":{"Analytical":3}},{"text":"Terrible, I have to write everything down.","tags":{"Adaptable":2}},{"text":"I only remember things I find interesting.","tags":{"Creative":2}}]},
        {"text":"How do you feel about physical fitness?","options":[{"text":"I love pushing my body to its absolute limits.","tags":{"Dedicated":3,"Practical":2}},{"text":"I enjoy yoga and stretching for mental clarity.","tags":{"Empathy":2,"Nature":2}},{"text":"I analyze fitness science and optimize workouts.","tags":{"Analytical":3,"Technical":2}},{"text":"I hate sweating.","tags":{"Easygoing":3}}]},
        {"text":"If a child is throwing a tantrum in public, you think:","options":[{"text":"'That poor parent must be so stressed.'","tags":{"Empathy":3}},{"text":"'I wonder what triggered the child's behavior.'","tags":{"Analytical":3,"Psychology":3}},{"text":"'Someone needs to discipline that kid.'","tags":{"Logical":2}},{"text":"'I need to get out of this store right now.'","tags":{"Independent":3}}]},
        {"text":"How do you handle sleep deprivation?","options":[{"text":"I can push through it with coffee and adrenaline.","tags":{"Dedicated":3,"Adaptable":2}},{"text":"I become very cranky and useless.","tags":{"Sensitive":3}},{"text":"I refuse to get less than 8 hours, it's unhealthy.","tags":{"Organized":3,"Logical":2}},{"text":"I take strategic power naps.","tags":{"Analytical":3}}]},
        {"text":"What is your view on mental health?","options":[{"text":"It is just as important as physical health.","tags":{"Empathy":3,"Logical":2}},{"text":"It can be solved by changing chemical imbalances.","tags":{"Analytical":3,"Technical":2}},{"text":"Nature and meditation are the best cures.","tags":{"Nature":3}},{"text":"People just need to toughen up.","tags":{"Practical":2,"Logical":1}}]},
        {"text":"How do you react when you get sick?","options":[{"text":"I research my symptoms extensively online.","tags":{"Analytical":3}},{"text":"I follow the doctor's orders perfectly.","tags":{"Organized":3}},{"text":"I drink tea, sleep, and use natural remedies.","tags":{"Nature":3,"Practical":2}},{"text":"I ignore it and keep going to work.","tags":{"Dedicated":3}}]},
        {"text":"When learning a physical task (like giving CPR), you:","options":[{"text":"Practice repeatedly on a dummy until perfect.","tags":{"Dedicated":3,"Practical":3}},{"text":"Memorize the textbook steps first.","tags":{"Analytical":3,"Organized":2}},{"text":"Ask the instructor to watch and correct my form.","tags":{"Communication":3}},{"text":"Hope I never actually have to use it.","tags":{"Sensitive":2}}]},
        {"text":"What do you think of alternative medicine (like acupuncture)?","options":[{"text":"If it makes the patient feel better, it's good.","tags":{"Empathy":3,"OpenMinded":3}},{"text":"It's a scam without peer-reviewed scientific proof.","tags":{"Logical":3,"Analytical":3}},{"text":"I want to learn how to do it.","tags":{"Creative":2,"Practical":2}},{"text":"I'm scared of needles.","tags":{"Sensitive":2}}]},
        {"text":"How good are you at multitasking in a chaotic room?","options":[{"text":"Excellent, I thrive when 5 things happen at once.","tags":{"Adaptable":3,"ProblemSolving":3}},{"text":"I can do it, but I make checklists to stay sane.","tags":{"Organized":3}},{"text":"Terrible. I need quiet to focus on one patient.","tags":{"Analytical":2,"Sensitive":2}},{"text":"I delegate the tasks to other people.","tags":{"Leadership":3}}]}
    ],
    "GovServices": [
        {"text":"When you see a pothole in your neighborhood, you:","options":[{"text":"Organize a petition to get the city to fix it.","tags":{"Leadership":3,"Communication":3}},{"text":"Research the city budget to see why roads are failing.","tags":{"Analytical":3,"Logical":2}},{"text":"Fill it with gravel yourself to help out.","tags":{"Practical":3,"ProblemSolving":2}},{"text":"Complain about it on social media.","tags":{"Expressive":2}}]},
        {"text":"What is the most important role of a government?","options":[{"text":"Maintaining law, order, and national security.","tags":{"Logical":3,"Organized":3}},{"text":"Providing welfare and protecting the vulnerable.","tags":{"Empathy":3,"Social":3}},{"text":"Building infrastructure (roads, schools, grids).","tags":{"Technical":3,"Practical":2}},{"text":"Balancing the budget and managing the economy.","tags":{"Analytical":3,"ProblemSolving":2}}]},
        {"text":"If a natural disaster strikes your city, you are the one who:","options":[{"text":"Coordinates the rescue volunteers.","tags":{"Leadership":3,"Organized":3}},{"text":"Operates the heavy machinery to clear debris.","tags":{"Technical":3,"Practical":3}},{"text":"Distributes food and blankets to victims.","tags":{"Empathy":3,"Dedicated":2}},{"text":"Analyzes the structural damage of buildings.","tags":{"Analytical":3,"Logical":2}}]},
        {"text":"How do you feel about working within strict bureaucracies?","options":[{"text":"I excel at navigating complex rules and forms.","tags":{"Organized":3,"Analytical":3}},{"text":"I find loopholes to get things done faster.","tags":{"ProblemSolving":3,"Resourceful":3}},{"text":"I hate the red tape, I want to change the system.","tags":{"Leadership":3,"Creative":2}},{"text":"I just follow instructions to avoid trouble.","tags":{"Practical":2,"Easygoing":2}}]},
        {"text":"Which historical figure do you admire most?","options":[{"text":"A military general who won a strategic war.","tags":{"Leadership":3,"Logical":3}},{"text":"A civil rights leader who changed society.","tags":{"Communication":3,"Empathy":3}},{"text":"An engineer who built a famous dam or bridge.","tags":{"Technical":3,"Practical":2}},{"text":"A diplomat who negotiated a lasting peace treaty.","tags":{"Analytical":3,"ProblemSolving":3}}]},
        {"text":"In a public town hall meeting, you would:","options":[{"text":"Give a passionate speech at the microphone.","tags":{"Communication":3,"Expressive":3}},{"text":"Take detailed notes on community concerns.","tags":{"Organized":3,"Empathy":2}},{"text":"Present a data-driven slideshow on taxes.","tags":{"Analytical":3,"Logical":2}},{"text":"Stand in the back and observe the crowd.","tags":{"Independent":2,"Observation":3}}]},
        {"text":"Your approach to urban planning is:","options":[{"text":"Focusing on green spaces and environmental impact.","tags":{"Nature":3,"Empathy":2}},{"text":"Optimizing traffic flow and public transit.","tags":{"Logical":3,"Technical":3}},{"text":"Ensuring affordable housing for low-income families.","tags":{"Social":3,"Empathy":3}},{"text":"Attracting big businesses to boost the economy.","tags":{"Leadership":3,"Analytical":2}}]},
        {"text":"What motivates you to choose a career in public service?","options":[{"text":"The desire to leave a lasting, positive legacy.","tags":{"Leadership":3,"Dedicated":3}},{"text":"The stability, benefits, and pension.","tags":{"Practical":3,"Organized":2}},{"text":"A deep sense of duty to my country/community.","tags":{"Empathy":3,"Logical":2}},{"text":"The opportunity to manage massive, complex systems.","tags":{"Analytical":3,"Technical":2}}]},
        {"text":"If you were a city mayor, what is your first project?","options":[{"text":"Expanding public parks and planting trees.","tags":{"Nature":3,"Empathy":2}},{"text":"Increasing funding for the police and fire departments.","tags":{"Logical":3,"Leadership":2}},{"text":"Digitizing all city records to eliminate paper.","tags":{"Technical":3,"Organized":2}},{"text":"Creating a task force for homelessness.","tags":{"Social":3,"ProblemSolving":2}}]},
        {"text":"How do you handle a conflict between two neighboring towns?","options":[{"text":"Review the state laws to see who has legal authority.","tags":{"Analytical":3,"Logical":3}},{"text":"Host a joint dinner to build relationships between leaders.","tags":{"Communication":3,"Social":3}},{"text":"Propose a financial compromise that benefits both.","tags":{"ProblemSolving":3,"Practical":2}},{"text":"Let them figure it out themselves.","tags":{"Independent":2}}]},
        {"text":"When analyzing a new proposed law, you look at:","options":[{"text":"How it affects the poorest citizens.","tags":{"Empathy":3,"Social":3}},{"text":"How much it will cost the taxpayers.","tags":{"Analytical":3,"Logical":2}},{"text":"Whether it is enforceable in the real world.","tags":{"Practical":3,"Organized":2}},{"text":"If it aligns with historical constitutional intent.","tags":{"Logical":3,"Analytical":2}}]},
        {"text":"What kind of intelligence work appeals to you?","options":[{"text":"Analyzing satellite imagery and intercepting codes.","tags":{"Technical":3,"Analytical":3}},{"text":"Working undercover to gather human intelligence.","tags":{"RiskTaking":3,"Communication":3}},{"text":"Writing policy briefings for the President.","tags":{"Organized":3,"Communication":2}},{"text":"Managing the logistics of an overseas base.","tags":{"Practical":3,"Organized":2}}]},
        {"text":"How do you feel about taxes?","options":[{"text":"They are a necessary pool of resources for the greater good.","tags":{"Social":3,"Empathy":2}},{"text":"They are too high and stifle economic growth.","tags":{"Logical":3,"Practical":2}},{"text":"They are too complicated and need a total redesign.","tags":{"ProblemSolving":3,"Analytical":2}},{"text":"I just pay them and don't think about it.","tags":{"Easygoing":3}}]},
        {"text":"If you worked in an embassy abroad, you would want to:","options":[{"text":"Host cultural events to share your nation's art/music.","tags":{"Creative":3,"Social":3}},{"text":"Negotiate trade deals with foreign ministers.","tags":{"Communication":3,"Logical":2}},{"text":"Process visas and help citizens in trouble.","tags":{"Organized":3,"Empathy":2}},{"text":"Ensure the physical security of the compound.","tags":{"Practical":3,"Dedicated":2}}]},
        {"text":"How do you respond to public criticism?","options":[{"text":"I release a detailed fact-sheet to clear up misconceptions.","tags":{"Analytical":3,"Organized":2}},{"text":"I hold a press conference to control the narrative.","tags":{"Communication":3,"Leadership":3}},{"text":"I ignore it and let my actions speak for themselves.","tags":{"Independent":3,"Dedicated":2}},{"text":"I get defensive and try to find out who started it.","tags":{"Sensitive":2}}]},
        {"text":"What is the biggest threat to modern society?","options":[{"text":"Cyberattacks on critical infrastructure.","tags":{"Technical":3,"Analytical":2}},{"text":"Climate change and natural resource depletion.","tags":{"Nature":3,"ProblemSolving":2}},{"text":"Wealth inequality and social division.","tags":{"Empathy":3,"Social":3}},{"text":"Political corruption and lack of leadership.","tags":{"Logical":3,"Leadership":2}}]},
        {"text":"When organizing a massive public event (like an election), you:","options":[{"text":"Design the secure database to count the votes.","tags":{"Technical":3,"Organized":3}},{"text":"Manage the volunteers at the polling stations.","tags":{"Leadership":3,"Communication":3}},{"text":"Ensure elderly and disabled people have access.","tags":{"Empathy":3,"Practical":2}},{"text":"Handle the physical setup of the voting booths.","tags":{"Practical":3}}]},
        {"text":"If you were a whistleblower, you would do it because:","options":[{"text":"The rules were broken and justice must be served.","tags":{"Logical":3,"Dedicated":3}},{"text":"People were being hurt by the cover-up.","tags":{"Empathy":3,"Social":3}},{"text":"I calculated that the truth would come out anyway.","tags":{"Analytical":3,"Practical":2}},{"text":"I wouldn't do it, I'd stay quiet to protect my job.","tags":{"Reserved":3}}]},
        {"text":"What is your view on public transportation?","options":[{"text":"It needs high-speed rail and better engineering.","tags":{"Technical":3,"ProblemSolving":2}},{"text":"It should be completely free for all citizens.","tags":{"Empathy":3,"Social":3}},{"text":"It needs better scheduling and fiscal management.","tags":{"Organized":3,"Analytical":2}},{"text":"I prefer driving my own car.","tags":{"Independent":3}}]},
        {"text":"When drafting a speech for a politician, you focus on:","options":[{"text":"Inspiring words that unite the audience.","tags":{"Communication":3,"Creative":3}},{"text":"Clear, hard facts that prove the policy works.","tags":{"Analytical":3,"Logical":2}},{"text":"Bullet points that outline exactly what will happen next.","tags":{"Organized":3,"Practical":2}},{"text":"I'd rather be the one giving the speech, not writing it.","tags":{"Leadership":3,"Expressive":3}}]},
        {"text":"How do you handle a crisis where resources are limited?","options":[{"text":"I create a strict rationing system based on math.","tags":{"Analytical":3,"Logical":3}},{"text":"I give to the most vulnerable (children, sick) first.","tags":{"Empathy":3,"Social":3}},{"text":"I try to find a creative way to generate more resources.","tags":{"ProblemSolving":3,"Resourceful":3}},{"text":"I take charge and make the tough calls nobody else will.","tags":{"Leadership":3,"Dedicated":2}}]},
        {"text":"What branch of the military interests you most?","options":[{"text":"Cyber Command (Defending networks).","tags":{"Technical":3,"Analytical":3}},{"text":"Army/Marines (Physical discipline and leadership).","tags":{"Dedicated":3,"Leadership":3}},{"text":"Corps of Engineers (Building infrastructure).","tags":{"Practical":3,"ProblemSolving":2}},{"text":"Medical Corps (Treating wounded soldiers).","tags":{"Empathy":3,"Healthcare":2}}]},
        {"text":"If you could pass one universal law, it would be:","options":[{"text":"Mandatory recycling and zero-emissions.","tags":{"Nature":3,"Logical":2}},{"text":"Universal basic income for everyone.","tags":{"Empathy":3,"Social":3}},{"text":"Free high-speed internet globally.","tags":{"Technical":3,"Communication":2}},{"text":"Strict transparency for all government spending.","tags":{"Analytical":3,"Organized":3}}]},
        {"text":"How do you interact with your local community?","options":[{"text":"I attend city council meetings and vote in every local election.","tags":{"Organized":3,"Logical":2}},{"text":"I volunteer at the local food bank or shelter.","tags":{"Empathy":3,"Social":3}},{"text":"I organize neighborhood block parties and events.","tags":{"Communication":3,"Leadership":2}},{"text":"I mostly keep to myself.","tags":{"Independent":3}}]},
        {"text":"What is the most challenging part of public service?","options":[{"text":"Dealing with angry, irrational citizens.","tags":{"Sensitive":3,"Communication":2}},{"text":"The slow, frustrating pace of getting anything approved.","tags":{"Practical":3,"ProblemSolving":3}},{"text":"The heavy emotional burden of seeing people struggle.","tags":{"Empathy":3,"Dedicated":2}},{"text":"Keeping track of changing laws and regulations.","tags":{"Analytical":3,"Organized":2}}]}
    ],
    "Entrepreneurship": [
        {"text":"You have $5,000 to invest. You:","options":[{"text":"Put it all into a high-risk, high-reward startup.","tags":{"RiskTaking":3,"Leadership":3}},{"text":"Invest it safely in an index fund for steady growth.","tags":{"Analytical":3,"Organized":2}},{"text":"Use it to buy inventory to start a side hustle.","tags":{"Practical":3,"ProblemSolving":3}},{"text":"Spend it on a marketing course to learn new skills.","tags":{"Resourceful":3,"Communication":2}}]},
        {"text":"When pitching a new idea to someone, you rely on:","options":[{"text":"Charisma, storytelling, and painting a vision.","tags":{"Communication":3,"Expressive":3}},{"text":"Hard data, market research, and spreadsheets.","tags":{"Analytical":3,"Logical":3}},{"text":"Showing them a physical prototype that works.","tags":{"Technical":3,"Practical":3}},{"text":"Highlighting how it helps people and solves pain points.","tags":{"Empathy":3,"Social":2}}]},
        {"text":"How do you handle failure?","options":[{"text":"I pivot immediately and try a new angle.","tags":{"Adaptable":3,"ProblemSolving":3}},{"text":"I analyze exactly what went wrong so it never happens again.","tags":{"Analytical":3,"Organized":3}},{"text":"I take it very personally and need time to recover.","tags":{"Sensitive":3}},{"text":"I use it as motivation to prove my doubters wrong.","tags":{"Leadership":3,"Dedicated":3}}]},
        {"text":"Your ideal Friday night involves:","options":[{"text":"Networking at a local business mixer.","tags":{"Social":3,"Communication":3}},{"text":"Coding or building out my personal website.","tags":{"Technical":3,"Independent":3}},{"text":"Reading a biography of a successful billionaire.","tags":{"Analytical":2,"Leadership":3}},{"text":"Relaxing, I strictly separate work and life.","tags":{"Easygoing":3,"Practical":2}}]},
        {"text":"If you were building a founding team, you would be the:","options":[{"text":"Hustler (Sales, Marketing, Vision).","tags":{"Communication":3,"Leadership":3}},{"text":"Hacker (Building the product, Coding).","tags":{"Technical":3,"ProblemSolving":3}},{"text":"Hipster (Design, Branding, UX).","tags":{"Creative":3,"Visual":3}},{"text":"Hound (Finance, Operations, Logistics).","tags":{"Organized":3,"Analytical":3}}]},
        {"text":"How do you view your competitors?","options":[{"text":"I study them obsessively to find their weaknesses.","tags":{"Analytical":3,"Logical":3}},{"text":"I want to crush them and dominate the market.","tags":{"Leadership":3,"RiskTaking":2}},{"text":"I ignore them and focus on making my product unique.","tags":{"Independent":3,"Creative":3}},{"text":"I try to partner with them for mutual benefit.","tags":{"Communication":3,"Adaptable":3}}]},
        {"text":"When setting prices for a product, you:","options":[{"text":"Calculate the exact cost of goods plus a 20% margin.","tags":{"Analytical":3,"Organized":3}},{"text":"Price it high to create a premium, luxury brand.","tags":{"Creative":3,"Psychology":2}},{"text":"Price it as low as possible to get maximum users.","tags":{"Practical":3,"Logical":2}},{"text":"Ask customers what they are willing to pay.","tags":{"Empathy":3,"Communication":3}}]},
        {"text":"What sounds like the biggest nightmare to you?","options":[{"text":"Working a boring 9-to-5 job for 40 years.","tags":{"RiskTaking":3,"Creative":3}},{"text":"Going bankrupt because of a bad business decision.","tags":{"Organized":3,"Analytical":2}},{"text":"Having to fire an employee who is a good friend.","tags":{"Empathy":3,"Social":3}},{"text":"Spending all day dealing with taxes and lawyers.","tags":{"Practical":3,"Technical":2}}]},
        {"text":"When starting a project, your first step is:","options":[{"text":"Registering the domain name and designing a logo.","tags":{"Creative":3,"Visual":2}},{"text":"Creating a detailed business plan and financial model.","tags":{"Analytical":3,"Organized":3}},{"text":"Talking to potential customers to see if they want it.","tags":{"Communication":3,"Empathy":2}},{"text":"Building a quick, ugly prototype to test the mechanics.","tags":{"Practical":3,"Technical":3}}]},
        {"text":"How do you prefer to manage a team?","options":[{"text":"Set clear KPIs and let them work independently.","tags":{"Organized":3,"Analytical":2}},{"text":"Lead from the front, working longer hours than anyone.","tags":{"Dedicated":3,"Leadership":3}},{"text":"Act as a mentor, focusing on their personal growth.","tags":{"Empathy":3,"Communication":2}},{"text":"I prefer to work completely solo.","tags":{"Independent":3}}]},
        {"text":"What is the best way to market a product?","options":[{"text":"Viral, funny TikToks and social media stunts.","tags":{"Creative":3,"Communication":3}},{"text":"Highly targeted, data-driven Facebook ads.","tags":{"Analytical":3,"Technical":2}},{"text":"Word of mouth by building a genuinely helpful product.","tags":{"Empathy":3,"Social":2}},{"text":"Cold calling and aggressive B2B sales.","tags":{"Leadership":3,"Dedicated":2}}]},
        {"text":"How do you view money?","options":[{"text":"It is a tool to buy freedom and independence.","tags":{"Independent":3,"Logical":2}},{"text":"It is a scoreboard to show how well I am doing.","tags":{"Leadership":3,"Analytical":2}},{"text":"It is fuel to scale my ideas to the moon.","tags":{"RiskTaking":3,"Imaginative":3}},{"text":"It is a resource to help my family and community.","tags":{"Empathy":3,"Social":2}}]},
        {"text":"If an investor offers you $1 Million for 50% of your company, you:","options":[{"text":"Take it! The money will let me grow instantly.","tags":{"Practical":3,"Adaptable":2}},{"text":"Reject it. I want to own 100% of my vision.","tags":{"Independent":3,"Leadership":3}},{"text":"Counter-offer using financial projections to prove my worth.","tags":{"Analytical":3,"Logical":3}},{"text":"Ask to consult with my team and mentors first.","tags":{"Communication":3,"Organized":2}}]},
        {"text":"What book genre do you prefer?","options":[{"text":"Self-help and productivity hacks.","tags":{"Organized":3,"Practical":2}},{"text":"Psychology and human behavior.","tags":{"Psychology":3,"Empathy":2}},{"text":"Biographies of ruthless historical conquerors.","tags":{"Leadership":3,"Logical":2}},{"text":"Sci-fi featuring futuristic technology.","tags":{"Imaginative":3,"Technical":2}}]},
        {"text":"When a customer complains, you:","options":[{"text":"Refund them immediately to protect my brand's reputation.","tags":{"Empathy":3,"Communication":2}},{"text":"Analyze the complaint to fix the root bug in the system.","tags":{"Analytical":3,"ProblemSolving":3}},{"text":"Argue with them if I know my product isn't broken.","tags":{"Logical":3,"Defensive":2}},{"text":"Delegate customer service to someone else.","tags":{"Leadership":2,"Organized":2}}]},
        {"text":"What is your stance on taking risks?","options":[{"text":"I love taking massive risks if the upside is huge.","tags":{"RiskTaking":3,"Adaptable":2}},{"text":"I only take heavily calculated, data-backed risks.","tags":{"Analytical":3,"Logical":3}},{"text":"I prefer slow, steady, and guaranteed growth.","tags":{"Organized":3,"Practical":3}},{"text":"I hate risk and avoid it at all costs.","tags":{"Reserved":3}}]},
        {"text":"If you had to choose a superpower for business, it would be:","options":[{"text":"Reading minds (to know what customers want).","tags":{"Empathy":3,"Psychology":3}},{"text":"Seeing the future (to predict market trends).","tags":{"Analytical":3,"Imaginative":3}},{"text":"Mind control (to close any sale).","tags":{"Leadership":3,"Communication":3}},{"text":"Super speed (to outwork everyone else).","tags":{"Dedicated":3,"Practical":2}}]},
        {"text":"How do you feel about public speaking or pitching?","options":[{"text":"I thrive on it. I love being on stage.","tags":{"Communication":3,"Expressive":3}},{"text":"I get nervous, but I practice until I'm perfect.","tags":{"Dedicated":3,"Organized":2}},{"text":"I hate it. I'd rather build the tech in the background.","tags":{"Independent":3,"Technical":3}},{"text":"I prefer 1-on-1 conversations over large crowds.","tags":{"Empathy":3,"Social":2}}]},
        {"text":"What is the main reason startups fail?","options":[{"text":"They run out of cash due to poor financial planning.","tags":{"Analytical":3,"Organized":3}},{"text":"They build a product nobody actually wants.","tags":{"Empathy":3,"Social":2}},{"text":"The founders give up too easily when it gets hard.","tags":{"Dedicated":3,"Leadership":2}},{"text":"Their technology is faulty or too slow.","tags":{"Technical":3,"ProblemSolving":2}}]},
        {"text":"When you have a great idea in the shower, you:","options":[{"text":"Immediately start coding or sketching it out.","tags":{"Practical":3,"Creative":3}},{"text":"Write it in my notes app and research the market size later.","tags":{"Organized":3,"Analytical":2}},{"text":"Call my best friend to pitch it to them.","tags":{"Communication":3,"Social":2}},{"text":"Forget it by the time I dry off.","tags":{"Easygoing":3}}]},
        {"text":"How do you handle multiple projects at once?","options":[{"text":"I use advanced project management software (Jira, Asana).","tags":{"Organized":3,"Technical":2}},{"text":"I focus obsessively on one until it's done, then move on.","tags":{"Dedicated":3,"Independent":2}},{"text":"I delegate the smaller ones to freelancers.","tags":{"Leadership":3,"Resourceful":3}},{"text":"I thrive in chaos and jump between them based on mood.","tags":{"Adaptable":3,"Creative":2}}]},
        {"text":"What is your approach to networking?","options":[{"text":"I carefully target industry leaders on LinkedIn.","tags":{"Analytical":3,"Organized":2}},{"text":"I go to parties and make friends naturally.","tags":{"Social":3,"Communication":3}},{"text":"I prefer to let my work attract people to me.","tags":{"Independent":3,"Practical":2}},{"text":"I try to help others first without expecting a return.","tags":{"Empathy":3,"Social":2}}]},
        {"text":"If your business started failing, you would:","options":[{"text":"Cut all expenses to the bone to survive.","tags":{"Logical":3,"Organized":3}},{"text":"Double down on marketing to force growth.","tags":{"RiskTaking":3,"Leadership":2}},{"text":"Pivot entirely to a new product line.","tags":{"Adaptable":3,"ProblemSolving":3}},{"text":"Sell the assets and start fresh.","tags":{"Practical":3,"Analytical":2}}]},
        {"text":"What does success look like to you in 10 years?","options":[{"text":"Ringing the bell at the New York Stock Exchange.","tags":{"Leadership":3,"RiskTaking":2}},{"text":"Having a small, highly profitable lifestyle business on a beach.","tags":{"Independent":3,"Easygoing":3}},{"text":"Changing the world with a sustainable, green product.","tags":{"Empathy":3,"Nature":2}},{"text":"Selling my tech to a major company like Google.","tags":{"Technical":3,"Analytical":2}}]},
        {"text":"How do you react to a team member who is underperforming?","options":[{"text":"Fire them quickly. It's just business.","tags":{"Logical":3,"Leadership":2}},{"text":"Put them on a strict performance improvement plan.","tags":{"Organized":3,"Analytical":2}},{"text":"Have a deep conversation to see what's wrong in their personal life.","tags":{"Empathy":3,"Communication":3}},{"text":"Move them to a different role where they might fit better.","tags":{"ProblemSolving":3,"Adaptable":2}}]}
    ],
    "Law": [
        {"text":"Two friends are arguing over a misunderstanding. You:","options":[{"text":"Analyze the facts and timeline to see who is right.","tags":{"Analytical":3,"Logical":3}},{"text":"Mediate and find a compromise so everyone is happy.","tags":{"Empathy":3,"Communication":3}},{"text":"Stay completely out of it.","tags":{"Independent":3,"Reserved":2}},{"text":"Use their argument to your advantage.","tags":{"ProblemSolving":3,"Leadership":2}}]},
        {"text":"When you sign a new app's Terms of Service, you:","options":[{"text":"Skim it quickly for data privacy clauses.","tags":{"Analytical":3,"Resourceful":2}},{"text":"Actually read the fine print carefully.","tags":{"Organized":3,"Dedicated":3}},{"text":"Scroll to the bottom and hit 'Accept' immediately.","tags":{"Practical":3,"Easygoing":3}},{"text":"Refuse to sign if it looks remotely suspicious.","tags":{"Logical":3,"Independent":2}}]},
        {"text":"If you were in a courtroom, which role appeals to you most?","options":[{"text":"The Judge, making the final, impartial decision.","tags":{"Leadership":3,"Logical":3}},{"text":"The Trial Lawyer, delivering a passionate closing argument.","tags":{"Communication":3,"Expressive":3}},{"text":"The Paralegal, finding the hidden loophole in the documents.","tags":{"Analytical":3,"Organized":3}},{"text":"The Expert Witness, explaining complex science to the jury.","tags":{"Technical":3,"Edu":3}}]},
        {"text":"How do you win a debate?","options":[{"text":"By presenting undeniable statistics and precedents.","tags":{"Logical":3,"Analytical":3}},{"text":"By appealing to the audience's morals and emotions.","tags":{"Communication":3,"Empathy":3}},{"text":"By aggressively poking holes in the opponent's logic.","tags":{"ProblemSolving":3,"Leadership":3}},{"text":"I don't debate; I prefer writing persuasive essays.","tags":{"Independent":3,"Organized":2}}]},
        {"text":"What is your view on the justice system?","options":[{"text":"It should focus heavily on rehabilitation and a second chance.","tags":{"Empathy":3,"Social":3}},{"text":"It must be strict to maintain order in society.","tags":{"Logical":3,"Organized":3}},{"text":"It's a complex game of strategy and negotiation.","tags":{"Analytical":3,"ProblemSolving":3}},{"text":"It needs to be completely rewritten to be fair.","tags":{"Creative":3,"Leadership":2}}]},
        {"text":"When negotiating a salary or buying a car, you:","options":[{"text":"Research market value extensively before speaking.","tags":{"Analytical":3,"Organized":3}},{"text":"Charm the other person into giving me a good deal.","tags":{"Communication":3,"Social":3}},{"text":"Set a hard walk-away number and don't budge.","tags":{"Logical":3,"Leadership":3}},{"text":"Get anxious and usually take the first offer.","tags":{"Sensitive":3,"Reserved":2}}]},
        {"text":"How do you handle a massive, boring pile of paperwork?","options":[{"text":"I create a highly organized filing system to tackle it.","tags":{"Organized":3,"Dedicated":3}},{"text":"I speed-read through it looking only for red flags.","tags":{"Analytical":3,"Practical":3}},{"text":"I procrastinate until the absolute deadline.","tags":{"Adaptable":2,"Creative":2}},{"text":"I digitize and automate the data entry process.","tags":{"Technical":3,"ProblemSolving":3}}]},
        {"text":"Someone breaks a minor rule, but for a morally good reason. You:","options":[{"text":"Report them; the law is the law, no exceptions.","tags":{"Logical":3,"Organized":3}},{"text":"Defend them; ethics are more important than strict rules.","tags":{"Empathy":3,"Communication":3}},{"text":"Look for a legal loophole to get them out of trouble.","tags":{"Analytical":3,"ProblemSolving":3}},{"text":"Ignore it, it's none of my business.","tags":{"Practical":3,"Independent":3}}]},
        {"text":"What type of true crime documentary do you prefer?","options":[{"text":"Deep dives into forensic science and DNA.","tags":{"Technical":3,"Analytical":2}},{"text":"Psychological profiles of the criminals.","tags":{"Psychology":3,"Empathy":2}},{"text":"Courtroom dramas about the legal trial process.","tags":{"Logical":3,"Communication":2}},{"text":"Stories about systemic corruption being exposed.","tags":{"Leadership":3,"ProblemSolving":2}}]},
        {"text":"When a friend asks you for advice on a difficult decision, you:","options":[{"text":"Outline the pros and cons logically.","tags":{"Analytical":3,"Logical":3}},{"text":"Ask them how they *feel* about the options.","tags":{"Empathy":3,"Communication":2}},{"text":"Tell them exactly what they should do based on rules.","tags":{"Leadership":3,"Organized":2}},{"text":"Help them brainstorm a creative third option.","tags":{"ProblemSolving":3,"Creative":2}}]},
        {"text":"If you witnessed a crime, you would:","options":[{"text":"Memorize the suspect's description and license plate.","tags":{"Analytical":3,"Observation":3}},{"text":"Rush in to try and stop it.","tags":{"Leadership":3,"RiskTaking":3}},{"text":"Check to see if the victim is okay first.","tags":{"Empathy":3,"Social":2}},{"text":"Record it on my phone for undeniable evidence.","tags":{"Technical":3,"Practical":2}}]},
        {"text":"How do you feel about keeping secrets?","options":[{"text":"I am a vault. I never tell anyone, period.","tags":{"Logical":3,"Dedicated":3}},{"text":"I keep them, unless withholding it hurts someone else.","tags":{"Empathy":3,"Analytical":2}},{"text":"I usually end up telling one trusted friend.","tags":{"Communication":3,"Social":2}},{"text":"I forget the secret within an hour anyway.","tags":{"Easygoing":3}}]},
        {"text":"Your preferred method of professional communication is:","options":[{"text":"A formally formatted, highly precise email.","tags":{"Organized":3,"Logical":3}},{"text":"A quick phone call to negotiate it verbally.","tags":{"Communication":3,"Adaptable":2}},{"text":"A face-to-face meeting over coffee.","tags":{"Social":3,"Empathy":2}},{"text":"Instant messaging (Slack/Teams).","tags":{"Technical":2,"Practical":3}}]},
        {"text":"When analyzing a complex document, you:","options":[{"text":"Highlight every definition and key term.","tags":{"Organized":3,"Analytical":3}},{"text":"Look for contradictory statements to exploit.","tags":{"ProblemSolving":3,"Logical":3}},{"text":"Focus on the overarching intent of the author.","tags":{"Empathy":2,"Communication":3}},{"text":"Use an AI tool to summarize it for me.","tags":{"Technical":3,"Resourceful":3}}]},
        {"text":"If you ran a law firm, your specialty would be:","options":[{"text":"Corporate Mergers and Tax Law.","tags":{"Analytical":3,"Organized":3}},{"text":"Civil Rights and Public Defender work.","tags":{"Empathy":3,"Social":3}},{"text":"Intellectual Property and Tech Patents.","tags":{"Technical":3,"Creative":2}},{"text":"High-profile Criminal Defense.","tags":{"Communication":3,"RiskTaking":3}}]},
        {"text":"How do you handle being proven wrong in an argument?","options":[{"text":"I concede gracefully if their evidence is better.","tags":{"Logical":3,"Analytical":3}},{"text":"I get defensive and try to pivot the topic.","tags":{"Defensive":3,"Communication":2}},{"text":"I apologize for misunderstanding their feelings.","tags":{"Empathy":3,"Social":2}},{"text":"I refuse to admit defeat.","tags":{"Leadership":2,"Dedicated":3}}]},
        {"text":"What is the most important skill for a lawyer?","options":[{"text":"An encyclopedic memory for case law.","tags":{"Organized":3,"Analytical":3}},{"text":"The ability to read people and juries.","tags":{"Psychology":3,"Empathy":3}},{"text":"Exceptional public speaking and charisma.","tags":{"Communication":3,"Expressive":3}},{"text":"Relentless aggression and negotiation skills.","tags":{"Leadership":3,"ProblemSolving":2}}]},
        {"text":"When organizing an event, you are the person who:","options":[{"text":"Drafts the contracts with vendors to avoid liability.","tags":{"Logical":3,"Analytical":3}},{"text":"Manages the budget spreadsheet down to the penny.","tags":{"Organized":3,"Practical":2}},{"text":"Hypeman who gets everyone excited to go.","tags":{"Communication":3,"Leadership":2}},{"text":"Makes sure everyone feels included and welcome.","tags":{"Empathy":3,"Social":3}}]},
        {"text":"How do you feel about strict dress codes (like suits)?","options":[{"text":"I like them; they command respect and authority.","tags":{"Leadership":3,"Organized":2}},{"text":"I hate them; I prefer to express my individuality.","tags":{"Creative":3,"Independent":3}},{"text":"I'll wear whatever is required to win the case.","tags":{"Practical":3,"Adaptable":3}},{"text":"I find them physically uncomfortable.","tags":{"Sensitive":3}}]},
        {"text":"If you find a loophole in a school/work rule, you:","options":[{"text":"Exploit it quietly for my own benefit.","tags":{"ProblemSolving":3,"Practical":2}},{"text":"Tell management so they can fix the flaw.","tags":{"Logical":3,"Organized":2}},{"text":"Tell all my friends so we can all use it.","tags":{"Social":3,"Communication":3}},{"text":"I don't look for loopholes; I just follow the rules.","tags":{"Dedicated":3,"Easygoing":2}}]},
        {"text":"What is your approach to historical research?","options":[{"text":"Cross-referencing multiple primary sources for accuracy.","tags":{"Analytical":3,"Organized":3}},{"text":"Focusing on the stories of marginalized groups.","tags":{"Empathy":3,"Social":3}},{"text":"Studying the evolution of political power.","tags":{"Leadership":3,"Logical":2}},{"text":"Looking at the technological advancements of the era.","tags":{"Technical":3,"Practical":2}}]},
        {"text":"If you were a detective, your strongest trait would be:","options":[{"text":"Following the paper trail of money.","tags":{"Analytical":3,"Organized":3}},{"text":"Interrogating suspects and reading their body language.","tags":{"Psychology":3,"Communication":3}},{"text":"Collecting and processing physical evidence.","tags":{"Technical":3,"Practical":3}},{"text":"Never giving up on a cold case.","tags":{"Dedicated":3,"Empathy":2}}]},
        {"text":"How do you feel about the phrase 'innocent until proven guilty'?","options":[{"text":"It is the absolute bedrock of a civilized society.","tags":{"Logical":3,"Analytical":3}},{"text":"It's a nice thought, but the system is biased.","tags":{"Empathy":3,"Social":3}},{"text":"It makes it too hard to put dangerous people away.","tags":{"Practical":3,"Leadership":2}},{"text":"I think it depends entirely on the evidence presented.","tags":{"ProblemSolving":3}}]},
        {"text":"When reading a contract, what do you look for first?","options":[{"text":"The termination and exit clauses.","tags":{"Analytical":3,"ProblemSolving":3}},{"text":"The compensation and payment terms.","tags":{"Practical":3,"Logical":2}},{"text":"The liability and indemnification sections.","tags":{"Organized":3,"Logical":3}},{"text":"I just read the summary my lawyer gives me.","tags":{"Resourceful":3,"Easygoing":2}}]},
        {"text":"What is your definition of 'Justice'?","options":[{"text":"The strict and equal application of the law to everyone.","tags":{"Logical":3,"Analytical":3}},{"text":"Restoring the victim and healing the community.","tags":{"Empathy":3,"Social":3}},{"text":"Ensuring the powerful cannot exploit the weak.","tags":{"Leadership":3,"ProblemSolving":3}},{"text":"An abstract concept that depends on who has the best lawyer.","tags":{"Practical":3,"Creative":2}}]}
    ]
};

// =====================================================================
// 2. INDIAN CAREERS DATABASE (Rule-Based Recommendation Base)
// =====================================================================
const careersDB = {
    "TechAI": [
        {
            "title": "Software Development Engineer (SDE)",
            "icon": "💻",
            "desc": "Build scalable software systems, cloud architectures, and web/mobile apps for top Indian IT giants, product MNCs, and unicorn startups.",
            "targetTraits": { "Technical": 3, "ProblemSolving": 3, "Analytical": 2 },
            "phases": [
                { "title": "Phase 1: Foundation (10+2 & Entrance)", "steps": "Complete Class 12 with PCM (Physics, Chemistry, Math). Appear for JEE Main, JEE Advanced, BITSAT, or State CETs to enter B.Tech Computer Science/IT." },
                { "title": "Phase 2: Skill Building & Internships", "steps": "Master Data Structures & Algorithms in C++/Java/Python. Solve 300+ LeetCode problems, contribute to open-source, and complete summer internships." },
                { "title": "Phase 3: Career Entry & Placements", "steps": "Participate in campus placements (Tier 1/2 colleges) or off-campus drives for companies like Google, Amazon, Microsoft, TCS, Swiggy, or Zomato." }
            ],
            "books": ["Data Structures and Algorithms Made Easy by Narasimha Karumanchi", "Cracking the Coding Interview by Gayle Laakmann McDowell"]
        },
        {
            "title": "AI / Machine Learning Engineer",
            "icon": "🤖",
            "desc": "Design neural networks, computer vision algorithms, and Generative AI models for India's booming AI startup and R&D ecosystem.",
            "targetTraits": { "Technical": 3, "Analytical": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: Academic Preparation", "steps": "Excel in Class 12 Mathematics & Physics. Pursue B.Tech in CSE / AI & Data Science or B.Sc Statistics/Maths at IITs, NITs, or IIITs." },
                { "title": "Phase 2: Specialization", "steps": "Learn Python, PyTorch, TensorFlow, Calculus, and Linear Algebra. Build NLP or Computer Vision projects on Kaggle." },
                { "title": "Phase 3: Industry & Higher Studies", "steps": "Secure AI R&D roles in tech MNCs (Bengaluru/Gurgaon), or clear GATE to pursue M.Tech/Ph.D. at IISc Bangalore or IITs." }
            ],
            "books": ["Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow by Aurélien Géron", "Deep Learning by Ian Goodfellow & Yoshua Bengio"]
        },
        {
            "title": "Cybersecurity & Ethical Hacker",
            "icon": "🛡️",
            "desc": "Protect digital infrastructure, banking systems, and defense networks across India from cyber threats and data breaches.",
            "targetTraits": { "Technical": 3, "Analytical": 2, "ProblemSolving": 3 },
            "phases": [
                { "title": "Phase 1: Tech Fundamentals", "steps": "Pass 10+2 Science stream. Earn a B.Tech in CSE/Cybersecurity or B.Sc IT. Understand computer networking and OS fundamentals." },
                { "title": "Phase 2: Certifications & Bug Bounties", "steps": "Clear industry certifications like CEH (Certified Ethical Hacker), CompTIA Security+, and OSCP. Participate in CTF challenges and Bug Bounty programs." },
                { "title": "Phase 3: Placement", "steps": "Join Security Operations Centers (SOCs) at Wipro, Infosys, CERT-In (Govt of India), or specialized cybersecurity firms." }
            ],
            "books": ["The Web Application Hacker's Handbook by Dafydd Stuttard", "CompTIA Security+ Study Guide by Mike Chapple"]
        },
        {
            "title": "Data Scientist / Business Analyst",
            "icon": "📊",
            "desc": "Transform massive datasets into strategic business decisions for fintech, e-commerce, and consulting firms in India.",
            "targetTraits": { "Analytical": 3, "Logical": 3, "Organized": 2 },
            "phases": [
                { "title": "Phase 1: Undergraduate Degree", "steps": "Pursue B.Tech, B.Sc Statistics, B.S. Data Science, or B.A. Economics (Hons) from reputed Indian universities (DU, ISI, IITs)." },
                { "title": "Phase 2: Analytics Tooling", "steps": "Master SQL, Python, R, Tableau, and Excel. Learn statistical modeling, A/B testing, and business domain logic." },
                { "title": "Phase 3: Analytics Entry", "steps": "Apply for Data Analyst or Business Analyst roles at Mu Sigma, Fractal Analytics, Deloitte, Flipkart, or McKinsey." }
            ],
            "books": ["Storytelling with Data by Cole Nussbaumer Knaflic", "Python for Data Analysis by Wes McKinney"]
        },
        {
            "title": "UI/UX Product Designer",
            "icon": "🎨",
            "desc": "Craft intuitive, accessible user interfaces for digital apps serving hundreds of millions of smartphone users across India.",
            "targetTraits": { "Creative": 3, "Empathy": 3, "Visual": 2 },
            "phases": [
                { "title": "Phase 1: Entrance & Degree", "steps": "Clear NID DAT or UCEED exams to get into National Institute of Design (NID) or IIT Industrial Design Centre (IDC) for B.Des." },
                { "title": "Phase 2: Portfolio Building", "steps": "Master Figma, Adobe XD, and user research methodologies. Conduct usability testing with real Indian target audiences and build case studies." },
                { "title": "Phase 3: Design Roles", "steps": "Join product design teams at Razorpay, Paytm, CRED, Zomato, or UX design agencies in Mumbai, Bengaluru, or Delhi NCR." }
            ],
            "books": ["The Design of Everyday Things by Don Norman", "Don't Make Me Think by Steve Krug"]
        },
        {
            "title": "Cloud & DevOps Engineer",
            "icon": "☁️",
            "desc": "Manage automated deployment pipelines, serverless infrastructure, and cloud security on AWS, Azure, and GCP.",
            "targetTraits": { "Technical": 3, "Organized": 3, "Practical": 2 },
            "phases": [
                { "title": "Phase 1: Computer Science Degree", "steps": "Complete B.Tech in CS/IT or BCA/MCA. Build strong command over Linux CLI, Bash scripting, and networking fundamentals." },
                { "title": "Phase 2: Cloud Certification", "steps": "Earn AWS Certified Solutions Architect or Azure Administrator credentials. Learn Docker, Kubernetes, Terraform, and Jenkins." },
                { "title": "Phase 3: Industry Role", "steps": "Join IT consulting, SaaS products, or MNC tech hubs as a Junior DevOps Engineer or Site Reliability Engineer (SRE)." }
            ],
            "books": ["The Phoenix Project by Gene Kim", "AWS Certified Solutions Architect Official Study Guide by Joe Baron"]
        }
    ],

    "ArtMusic": [
        {
            "title": "Music Composer & Sound Producer",
            "icon": "🎧",
            "desc": "Compose soundscapes, background scores, and songs for Indian OTT series, Bollywood/regional films, gaming, and ad commercials.",
            "targetTraits": { "Creative": 3, "Auditory": 3, "Expressive": 2 },
            "phases": [
                { "title": "Phase 1: Music Training & Foundation", "steps": "Gain formal training in Indian Classical (Hindustani/Carnatic) or Western Music (Trinity/ABRSM). Learn piano or guitar." },
                { "title": "Phase 2: Digital Music Production", "steps": "Diploma/Degree in Sound Engineering from Whistling Woods, FTII Pune, or KM Music Conservatory. Master Logic Pro X, Ableton Live, and mixing." },
                { "title": "Phase 3: Industry Portfolio", "steps": "Compose for indie short films, jingles, and indie artist collaborations. Pitch portfolios to directors and record labels in Mumbai/Chennai." }
            ],
            "books": ["Musicophilia by Oliver Sacks", "The Music Producer's Handbook by Bobby Owsinski"]
        },
        {
            "title": "Graphic Designer & Visual Artist",
            "icon": "🖼️",
            "desc": "Design visual branding, advertising campaigns, and digital art for leading Indian creative agencies and global brands.",
            "targetTraits": { "Creative": 3, "Visual": 3, "Expressive": 2 },
            "phases": [
                { "title": "Phase 1: Fine Arts / Design Degree", "steps": "Clear NIFT / NID entrance exams or B.FA (Bachelor of Fine Arts) from Sir J.J. School of Art or College of Art, Delhi." },
                { "title": "Phase 2: Software Mastery & Style", "steps": "Master Adobe Creative Suite (Photoshop, Illustrator, InDesign). Develop a distinct visual storytelling style and Behance portfolio." },
                { "title": "Phase 3: Agency / Freelance Entry", "steps": "Work with creative agencies like Ogilvy India, Dentsu, or start your own visual design boutique." }
            ],
            "books": ["Designing Brand Identity by Alina Wheeler", "Grid Systems in Graphic Design by Josef Müller-Brockmann"]
        },
        {
            "title": "Filmmaker & Video Director",
            "icon": "🎬",
            "desc": "Direct visual stories, web series, ad films, and documentaries for the expanding Indian digital and film ecosystem.",
            "targetTraits": { "Creative": 3, "Communication": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: Entrance & Media School", "steps": "Clear FTII Jet Exam (Film and Television Institute of India, Pune) or SRFTI Kolkata for Direction and Screenwriting." },
                { "title": "Phase 2: Short Films & Assisting", "steps": "Write and direct independent short films for film festivals. Work as an Assistant Director (AD) under established Indian directors." },
                { "title": "Phase 3: Debut Feature / Web Series", "steps": "Pitch web series bibles or feature scripts to OTT platforms (Netflix India, Amazon Prime, SonyLIV) and production houses." }
            ],
            "books": ["Making Movies by Sidney Lumet", "In the Blink of an Eye by Walter Murch"]
        },
        {
            "title": "3D Animator & Game Artist",
            "icon": "🎮",
            "desc": "Create 3D character models, visual effects (VFX), and game environments for top Indian VFX studios and international titles.",
            "targetTraits": { "Creative": 3, "Technical": 2, "Visual": 3 },
            "phases": [
                { "title": "Phase 1: Animation Diploma/Degree", "steps": "Pursue B.Sc in Animation & VFX or B.Des from institutes like MAAC, Arena, or NID." },
                { "title": "Phase 2: Tool Specialization", "steps": "Learn Blender, Maya, ZBrush, and Unreal Engine 5. Build a high-quality 3D showreel demonstrating lighting, rigging, or modeling." },
                { "title": "Phase 3: Studio Placement", "steps": "Join premier Indian VFX/Animation studios like Redchillies.vfx, Technicolor India, or gaming studios like Ubisoft India." }
            ],
            "books": ["The Animator's Survival Kit by Richard Williams", "Creating 3D Game Art for the Real-Time Engine by Luke Ahearn"]
        },
        {
            "title": "Interior & Space Designer",
            "icon": "🏛️",
            "desc": "Transform residential spaces, corporate offices, and luxury retail stores across urban India into functional artistic experiences.",
            "targetTraits": { "Creative": 3, "Organized": 2, "Visual": 3 },
            "phases": [
                { "title": "Phase 1: Design Degree", "steps": "Clear NATA / CEED / NID entrance exams for B.Des Interior Design or B.Arch." },
                { "title": "Phase 2: CAD & 3D Rendering", "steps": "Learn AutoCAD, SketchUp, 3ds Max, and material sourcing in the local Indian market. Complete site execution internships." },
                { "title": "Phase 3: Practice or Studio", "steps": "Work with reputed architectural firms or launch an independent Interior Design studio catering to residential and commercial clients." }
            ],
            "books": ["Interior Design Illustrated by Francis D. K. Ching", "The Interior Design Handbook by Frida Ramstedt"]
        },
        {
            "title": "Classical / Contemporary Vocalist & Educator",
            "icon": "🎤",
            "desc": "Perform, record, and mentor the next generation of vocal talent across Indian classical, fusion, and commercial genres.",
            "targetTraits": { "Expressive": 3, "Auditory": 3, "Dedicated": 3 },
            "phases": [
                { "title": "Phase 1: Classical Guru-Shishya / Academic", "steps": "Undergo rigorous training in Hindustani/Carnatic vocal traditions or complete Sangeet Visharad / M.A. Music." },
                { "title": "Phase 2: Recordings & Live Stage", "steps": "Collaborate on fusion tracks, perform at classical Sangeet Sammelans, and build a digital YouTube/Spotify presence." },
                { "title": "Phase 3: Concerts & Vocal Coaching", "steps": "Establish a personal vocal academy, tour internationally, and record playback for regional/commercial projects." }
            ],
            "books": ["Ragas and Beyond by Ashok Da. Ranade", "The Voice Book by Michael McCallion"]
        }
    ],

    "Healthcare": [
        {
            "title": "Medical Specialist (MD / MS Doctor)",
            "icon": "🩺",
            "desc": "Diagnose complex illnesses, perform surgeries, and provide primary healthcare in leading Indian government and private hospitals.",
            "targetTraits": { "Technical": 3, "Empathy": 3, "Dedicated": 3 },
            "phases": [
                { "title": "Phase 1: NEET-UG & MBBS", "steps": "Complete 10+2 with PCB (Physics, Chemistry, Biology). Crack NEET-UG to secure an MBBS seat in AIIMS, JIPMER, or state medical colleges." },
                { "title": "Phase 2: Internship & Specialization", "steps": "Complete 1-year compulsory rotatory internship. Crack NEET-PG or INI-CET to pursue MD/MS in Clinical branches." },
                { "title": "Phase 3: Clinical Practice", "steps": "Join premier hospitals like Apollo, Fortis, Max, or state civil hospitals; or pursue DM/MCh super-specialization." }
            ],
            "books": ["Bailey & Love's Short Practice of Surgery", "BD Chaurasia's Human Anatomy"]
        },
        {
            "title": "Clinical Psychologist / Psychotherapist",
            "icon": "🧠",
            "desc": "Provide therapy, mental health assessment, and counseling across schools, hospitals, and private clinics in India.",
            "targetTraits": { "Empathy": 3, "Psychology": 3, "Communication": 3 },
            "phases": [
                { "title": "Phase 1: Undergraduate Studies", "steps": "Complete 10+2 in any stream. Pursue B.A. or B.Sc in Psychology from DU, Christ University, or state universities." },
                { "title": "Phase 2: Post-Graduation & M.Phil", "steps": "Complete M.A./M.Sc in Clinical Psychology followed by RCI-recognized M.Phil in Clinical Psychology from NIMHANS or CIP Ranchi." },
                { "title": "Phase 3: RCI License & Practice", "steps": "Register with the Rehabilitation Council of India (RCI) as a licensed Clinical Psychologist and start hospital consultancy or private practice." }
            ],
            "books": ["Thinking, Fast and Slow by Daniel Kahneman", "Man's Search for Meaning by Viktor E. Frankl"]
        },
        {
            "title": "Biotechnologist & Medical Researcher",
            "icon": "🔬",
            "desc": "Develop new vaccines, biopharmaceuticals, and genetic therapies within India's growing bio-economy and research institutes.",
            "targetTraits": { "Analytical": 3, "Technical": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: B.Tech / B.Sc Biotechnology", "steps": "Pass 10+2 PCB/PCM. Clear entrance exams for B.Tech/B.Sc Biotechnology at IITs, VIT, or Central Universities." },
                { "title": "Phase 2: Entrance for Research", "steps": "Clear GATE, GAT-B, or CSIR-NET. Complete M.Tech / M.Sc Biotechnology or Integrated Ph.D." },
                { "title": "Phase 3: R&D Industry Entry", "steps": "Work as an R&D Scientist in pharmaceutical giants like Biocon, Serum Institute of India, Bharat Biotech, or ICMR laboratories." }
            ],
            "books": ["Molecular Biology of the Cell by Bruce Alberts", "Biotechnology by U. Satyanarayana"]
        },
        {
            "title": "Physiotherapist (BPT / MPT)",
            "icon": "🦴",
            "desc": "Help patients recover from sports injuries, neurological trauma, and post-surgery mobility challenges.",
            "targetTraits": { "Practical": 3, "Empathy": 3, "Dedicated": 2 },
            "phases": [
                { "title": "Phase 1: BPT Admission", "steps": "Complete 10+2 with PCB. Secure admission to Bachelor of Physiotherapy (BPT) via state medical entrance exams or NEET." },
                { "title": "Phase 2: Clinical Internship & MPT", "steps": "Complete 4.5 years of study including a 6-month hospital internship. Specialize in Orthopedics, Sports, or Neurology via MPT." },
                { "title": "Phase 3: Practice & Sports Teams", "steps": "Work with Indian sports teams, rehabilitation centers, multi-specialty hospitals, or open an independent clinic." }
            ],
            "books": ["Physical Rehabilitation by Susan B. O'Sullivan", "Joint Structure and Function by Pamela K. Levangie"]
        },
        {
            "title": "Healthcare / Hospital Administrator",
            "icon": "🏥",
            "desc": "Manage multi-specialty hospital operations, medical ethics, staff logistics, and quality compliance across Indian healthcare networks.",
            "targetTraits": { "Organized": 3, "Leadership": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: Bachelor's Degree", "steps": "Earn a degree in Life Sciences, MBBS, BDS, Nursing, or BBA from a recognized Indian university." },
                { "title": "Phase 2: MHA / MBA Healthcare", "steps": "Clear CAT / CMAT / TISSNET. Pursue Master of Hospital Administration (MHA) or MBA in Healthcare Management from TISS, AIIMS, or top B-schools." },
                { "title": "Phase 3: Management Career", "steps": "Join hospital management cadres at Apollo, Fortis, Manipal Hospitals, or medical insurance companies." }
            ],
            "books": ["Hospital Administration and Management by C.M. Francis", "High Output Management by Andrew S. Grove"]
        },
        {
            "title": "Pharmacist & Drug Inspector",
            "icon": "💊",
            "desc": "Formulate life-saving drugs, oversee pharmacy operations, and enforce drug safety regulations under state and central agencies.",
            "targetTraits": { "Organized": 3, "Analytical": 2, "Practical": 3 },
            "phases": [
                { "title": "Phase 1: B.Pharm Admission", "steps": "Complete Class 12 with PCM/PCB. Pass GPAT or State CET for Bachelor of Pharmacy (B.Pharm)." },
                { "title": "Phase 2: Registration & Master's", "steps": "Register with the State Pharmacy Council. Optionally clear GPAT for M.Pharm in Pharmaceutics or Pharmacology." },
                { "title": "Phase 3: Corporate or Govt Exam", "steps": "Join QA/QC in Sun Pharma/Cipla or crack State Public Service Commission exams for Drug Inspector roles." }
            ],
            "books": ["Remington: The Science and Practice of Pharmacy", "Pharmacological Basis of Therapeutics by Goodman & Gilman"]
        }
    ],

    "GovServices": [
        {
            "title": "Civil Servant (IAS / IPS / IFS)",
            "icon": "🇮🇳",
            "desc": "Formulate national policies, maintain law and order, and lead district governance as part of India's premier administrative services.",
            "targetTraits": { "Leadership": 3, "Analytical": 3, "Dedicated": 3 },
            "phases": [
                { "title": "Phase 1: Graduation Stream", "steps": "Complete a Bachelor's degree in any discipline (Humanities, Engineering, Medicine, Science) from a recognized university." },
                { "title": "Phase 2: UPSC CSE Preparation", "steps": "Dedicate 1-2 years to mastering General Studies, CSAT, and an Optional Subject. Clear UPSC CSE Prelims, Mains, and Personality Test." },
                { "title": "Phase 3: LBSNAA Training & Cadetship", "steps": "Undergo foundational training at LBSNAA Mussoorie (or SVPNPA Hyderabad for IPS) before getting posted as Assistant Collector/SDM." }
            ],
            "books": ["Indian Polity by M. Laxmikanth", "India's Struggle for Independence by Bipan Chandra"]
        },
        {
            "title": "Defense Officer (Army / Navy / Air Force)",
            "icon": "🎖️",
            "desc": "Command armed units, strategic operations, and defend the sovereignty and security of the Indian republic.",
            "targetTraits": { "Leadership": 3, "Dedicated": 3, "Practical": 3 },
            "phases": [
                { "title": "Phase 1: Written Entrance", "steps": "Appear for NDA exam after 10+2 (PCM for Air Force/Navy) or CDS exam after Graduation conducted by UPSC." },
                { "title": "Phase 2: SSB Interview & Medicals", "steps": "Clear the 5-day Service Selection Board (SSB) interview evaluating officer-like qualities (OLQs) and physical standards." },
                { "title": "Phase 3: Military Academy Training", "steps": "Complete 3-4 years training at NDA Khadakwasla, IMA Dehradun, INA Ezhimala, or AFA Dundigal to be commissioned as Lieutenant/Flying Officer." }
            ],
            "books": ["SSB Interview: The Complete Guide by Dr. N.K. Natarajan", "The Brave: Param Vir Chakra Stories by Rachna Bisht Rawat"]
        },
        {
            "title": "PSU Engineering Executive (via GATE)",
            "icon": "⚙️",
            "desc": "Manage power grids, oil refineries, space programs, and heavy engineering infrastructure in India's top Navratna/Maharatna companies.",
            "targetTraits": { "Technical": 3, "Organized": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: Engineering Degree", "steps": "Earn a B.Tech/B.E. in Mechanical, Electrical, Civil, CS, or Chemical Engineering from an AICTE-approved college." },
                { "title": "Phase 2: GATE Examination", "steps": "Score an All India Rank (AIR) under 300 in the Graduate Aptitude Test in Engineering (GATE) during final year/after." },
                { "title": "Phase 3: PSU Executive Trainee", "steps": "Clear interview rounds for Maharatnas like ONGC, IOCL, NTPC, BHEL, ISRO, or DRDO as Assistant Executive Engineer." }
            ],
            "books": ["GATE Engineering Mathematics by MADE EASY Editorial Board", "Objective Type Questions in Engineering by R.K. Jain"]
        },
        {
            "title": "Urban Planner & Public Policy Analyst",
            "icon": "🏙️",
            "desc": "Design smart cities, sustainable transport networks, and public welfare schemes for state and central government NITI Aayog initiatives.",
            "targetTraits": { "Analytical": 3, "ProblemSolving": 3, "Organized": 2 },
            "phases": [
                { "title": "Phase 1: B.Plan / B.Arch / B.A. Economics", "steps": "Pursue Bachelor of Planning (B.Plan) via JEE Main Paper 2 or B.A. Economics/Political Science." },
                { "title": "Phase 2: Master's in Policy / Planning", "steps": "Earn M.Plan from SPA Delhi/ISET or M.A. Public Policy from NLSIU Bangalore, TISS, or ISPP." },
                { "title": "Phase 3: Policy / Urban Body Placement", "steps": "Work with NITI Aayog, Smart City Mission consultancies, World Bank India, or Municipal Corporations." }
            ],
            "books": ["Urbanization in India by K.C. Sivaramakrishnan", "Public Policy in India by Rajesh Chakrabarti"]
        },
        {
            "title": "Diplomat / Foreign Service Officer (IFS)",
            "icon": "🌐",
            "desc": "Represent India in international summits, manage bilateral treaties, and safeguard Indian diaspora interests worldwide.",
            "targetTraits": { "Communication": 3, "Analytical": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: Graduation Degree", "steps": "Graduate in International Relations, History, Law, or any subject with a deep command over English and General Studies." },
                { "title": "Phase 2: UPSC CSE High Rank", "steps": "Secure a top rank (usually Top 100 AIR) in the UPSC Civil Services Examination opting for IFS." },
                { "title": "Phase 3: Foreign Service Institute (FSI)", "steps": "Complete diplomatic training at Sushma Swaraj Institute of Foreign Service, Delhi, and master a compulsory foreign language." }
            ],
            "books": ["The India Way: Strategies for an Uncertain World by S. Jaishankar", "Pax Indica by Shashi Tharoor"]
        },
        {
            "title": "State Public Service Officer (State PSC / Tehsildar)",
            "icon": "📜",
            "desc": "Manage revenue administration, rural development, and state welfare distribution at block and sub-divisional levels.",
            "targetTraits": { "Organized": 3, "Practical": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: Bachelor's Degree", "steps": "Complete graduation in any stream from a recognized university." },
                { "title": "Phase 2: State PSC Examination", "steps": "Appear for State PSC exams (e.g., MPSC, UPPSC, BPSC, KPSC, RAS). Clear Prelims, Mains, and Interview." },
                { "title": "Phase 3: Administrative Cadre", "steps": "Get appointed as Deputy Collector, Block Development Officer (BDO), or Commercial Tax Officer in state administration." }
            ],
            "books": ["State Specific General Knowledge Manuals (Arihant/Pearson)", "Indian Economy by Ramesh Singh"]
        }
    ],

    "Entrepreneurship": [
        {
            "title": "Tech Startup Founder (D2C / B2B SaaS)",
            "icon": "🚀",
            "desc": "Build scalable technology products solving unique problems for India's 1.4 billion population or global SaaS buyers.",
            "targetTraits": { "RiskTaking": 3, "Leadership": 3, "ProblemSolving": 3 },
            "phases": [
                { "title": "Phase 1: Technical / Business Degree", "steps": "Pursue B.Tech from IITs/NITs or BBA/IPMAT. Build network through E-Cells and hackathons." },
                { "title": "Phase 2: MVP & Seed Incubation", "steps": "Develop a Minimum Viable Product (MVP). Register under Startup India scheme and pitch to incubators (CIIE IIMA, NSRCEL IIMB)." },
                { "title": "Phase 3: Venture Capital & Scale", "steps": "Pitch to Indian angel networks (IAN, Surge, Blume Ventures) for Seed/Series A rounds and scale operations." }
            ],
            "books": ["The High-Performance Entrepreneur by Subroto Bagchi", "Doglapan by Ashneer Grover"]
        },
        {
            "title": "D2C E-Commerce Brand Creator",
            "icon": "🛍️",
            "desc": "Launch, market, and scale consumer lifestyle, beauty, or food brands directly to online consumers across tier 1-3 India.",
            "targetTraits": { "Creative": 3, "Communication": 3, "Practical": 2 },
            "phases": [
                { "title": "Phase 1: Market Research & Supply Chain", "steps": "Identify niche consumer needs. Source manufacturing partners in Indian industrial hubs (Gujarat, Tirupur, NCR)." },
                { "title": "Phase 2: Digital Marketing & Storefront", "steps": "Build Shopify store, run performance marketing (Meta/Google Ads), and leverage influencer campaigns." },
                { "title": "Phase 3: Marketplace & Omnichannel", "steps": "Expand brand presence on Amazon India, Flipkart, Blinkit, and retail store chains." }
            ],
            "books": ["Building a StoryBrand by Donald Miller", "Shoe Dog by Phil Knight"]
        },
        {
            "title": "Agri-Tech & Rural Innovator",
            "icon": "🌾",
            "desc": "Modernize Indian agriculture with IoT sensors, drone spraying, supply chain logistics, and direct farm-to-fork platforms.",
            "targetTraits": { "ProblemSolving": 3, "Nature": 3, "Practical": 3 },
            "phases": [
                { "title": "Phase 1: B.Sc Agriculture / B.Tech", "steps": "Earn B.Sc Agriculture from ICAR institutes or B.Tech in Agricultural Engineering." },
                { "title": "Phase 2: Ground Validation & NABARD Grants", "steps": "Spend months in rural mandis and farms. Apply for NABARD and Ministry of Agriculture innovation grants." },
                { "title": "Phase 3: FPO & Supply Chain Integration", "steps": "Partner with Farmer Producer Organizations (FPOs) and institutional buyers to build sustainable rural distribution networks." }
            ],
            "books": ["The Lean Startup by Eric Ries", "Banker to the Poor by Muhammad Yunus"]
        },
        {
            "title": "Venture Capital Analyst & Angel Investor",
            "icon": "💼",
            "desc": "Evaluate disruptive startups, conduct financial due diligence, and fund high-potential Indian entrepreneurs.",
            "targetTraits": { "Analytical": 3, "Logical": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: Top Tier Degree", "steps": "Graduate from IITs, SRCC, or earn a B.Com/B.Tech followed by CFA or CA credentials." },
                { "title": "Phase 2: MBA & IB/Consulting Experience", "steps": "Crack CAT for IIMs/ISB. Work 2-3 years in Investment Banking or Management Consulting (McKinsey/Bain)." },
                { "title": "Phase 3: VC Fund Associate", "steps": "Join VC firms (Sequoia/Peak XV, Accel India, Elevation Capital) analyzing deal flows and term sheets." }
            ],
            "books": ["Venture Deals by Brad Feld and Jason Mendelson", "Zero to One by Peter Thiel"]
        },
        {
            "title": "Social Entrepreneur & NGO Founder",
            "icon": "🤝",
            "desc": "Solve grassroots challenges in education, sanitation, and women empowerment through self-sustaining business models.",
            "targetTraits": { "Empathy": 3, "Leadership": 3, "Social": 3 },
            "phases": [
                { "title": "Phase 1: Social Work / Development Degree", "steps": "Pursue B.A./M.A. in Social Work (BSW/MSW) from TISS Mumbai or Azim Premji University." },
                { "title": "Phase 2: Fellowship & Pilot Project", "steps": "Complete Teach for India or Gandhi Fellowship. Pilot a sustainable, low-cost social impact project." },
                { "title": "Phase 3: CSR Funding & FCRA", "steps": "Register Section 8 company/NGO, secure Indian corporate CSR grants, and obtain FCRA certification for international support." }
            ],
            "books": ["Half the Sky by Nicholas Kristof & Sheryl WuDunn", "To Change the World by Michael Woolcock"]
        },
        {
            "title": "Franchise & Retail Business Owner",
            "icon": "🏬",
            "desc": "Build multi-outlet retail chains, QSR food joints, and fitness centers across growing tier-2 Indian cities.",
            "targetTraits": { "Organized": 3, "Practical": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: BBA / Commerce Foundation", "steps": "Complete B.Com or BBA with a focus on working capital management and retail operations." },
                { "title": "Phase 2: Master Franchise Rights", "steps": "Identify proven national QSR/retail brands. Negotiate master franchise agreements and site leases." },
                { "title": "Phase 3: Multi-Unit Expansion", "steps": "Optimize inventory turnover, train floor staff, and reinvest profits into opening multiple regional stores." }
            ],
            "books": ["The E-Myth Revisited by Michael E. Gerber", "Retail Management by Swapna Pradhan"]
        }
    ],

    "Law": [
        {
            "title": "Corporate Law Associate",
            "icon": "⚖️",
            "desc": "Advise multinational companies, PE funds, and startups on cross-border M&A, contracts, and SEBI compliance.",
            "targetTraits": { "Analytical": 3, "Logical": 3, "Organized": 2 },
            "phases": [
                { "title": "Phase 1: CLAT & NLU Degree", "steps": "Crack CLAT or AILET exam after Class 12 to secure a seat in top NLUs (NLSIU Bangalore, NALSAR, WBNUJS) for 5-year B.A. LL.B." },
                { "title": "Phase 2: Law Firm Internships", "steps": "Build strong academic record, participate in moot courts, and complete internships at Tier-1 law firms (AZB, SAM, CAM, Trilegal)." },
                { "title": "Phase 3: Campus Placement & AIBE", "steps": "Clear All India Bar Examination (AIBE) and join Tier-1/2 corporate law firms as a Junior Associate." }
            ],
            "books": ["Introduction to the Constitution of India by D.D. Basu", "Working a Democratic Constitution by Granville Austin"]
        },
        {
            "title": "Litigation Advocate (District / High Court / Supreme Court)",
            "icon": "🏛️",
            "desc": "Argue civil and criminal cases directly in courtrooms, defending constitutional rights and client justice.",
            "targetTraits": { "Communication": 3, "Logical": 3, "Leadership": 2 },
            "phases": [
                { "title": "Phase 1: LL.B Degree", "steps": "Complete 5-year integrated LL.B or 3-year LL.B after graduation from a Bar Council of India (BCI) recognized university." },
                { "title": "Phase 2: Bar Enrollment & Junior Practice", "steps": "Enroll with the State Bar Council, pass AIBE, and join the chambers of a Senior Advocate at High Court or Supreme Court." },
                { "title": "Phase 3: Independent Practice", "steps": "Develop a specialized practice area (Criminal, Tax, Constitutional Law) and build an independent client base." }
            ],
            "books": ["Before Memory Fades by Fali S. Nariman", "Legal Eagles by Indu Bhan"]
        },
        {
            "title": "Judicial Officer (Civil Judge / PCS-J)",
            "icon": "👩‍⚖️",
            "desc": "Preside over court trials, interpret statutes, and deliver binding judgments in Indian district judiciary courts.",
            "targetTraits": { "Logical": 3, "Analytical": 3, "Organized": 3 },
            "phases": [
                { "title": "Phase 1: Law Graduation", "steps": "Earn LL.B degree with a deep understanding of IPC/BNS, CrPC/BNSS, Evidence Act, and Code of Civil Procedure." },
                { "title": "Phase 2: Judicial Services Exam (PCS-J)", "steps": "Prepare for State Judicial Services Examination. Clear Prelims, Mains (judgment writing), and Viva-Voce." },
                { "title": "Phase 3: Judicial Academy Training", "steps": "Complete 1-year residential training at the State Judicial Academy and get posted as Civil Judge Junior Division / Judicial Magistrate." }
            ],
            "books": ["Landmark Judgments That Changed India by Ashok Desai", "Courts and Their Judgments by Arun Shourie"]
        },
        {
            "title": "Cyber & Intellectual Property (IP) Lawyer",
            "icon": "🔒",
            "desc": "Protect software patents, trademarks, copyrights, and defend digital privacy disputes in specialized IP forums and tribunals.",
            "targetTraits": { "Technical": 3, "Analytical": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: Science/Engineering + Law", "steps": "Complete B.Tech/B.Sc followed by LL.B, or 5-year B.Tech LL.B (Intellectual Property Rights) specialized degree." },
                { "title": "Phase 2: Patent Agent Exam", "steps": "Clear the Indian Patent Agent Examination conducted by CGPDTM to become a registered Patent Agent." },
                { "title": "Phase 3: IP Boutique / Tech Firm", "steps": "Work with IP law boutiques (Anand and Anand, Remfry & Sagar) or tech MNCs protecting patents and trademark portfolios." }
            ],
            "books": ["Law Relating to Intellectual Property by Dr. B.L. Wadehra", "Cyber Law in India by Farooq Ahmad"]
        },
        {
            "title": "Public Prosecutor / Government Standing Counsel",
            "icon": "⚖️",
            "desc": "Represent state and central government departments in prosecuting criminal offenses and defending government policies.",
            "targetTraits": { "Dedicated": 3, "Communication": 3, "Logical": 2 },
            "phases": [
                { "title": "Phase 1: Law Degree & Active Practice", "steps": "Obtain LL.B degree and complete minimum 3 to 7 years of active litigation practice in criminal courts." },
                { "title": "Phase 2: Assistant Public Prosecutor (APP) Exam", "steps": "Appear for State Public Service Commission APP / Director of Prosecution recruitment examinations." },
                { "title": "Phase 3: State Prosecution Officer", "steps": "Serve as State Prosecutor in Magistrate/Sessions courts, conducting criminal trials on behalf of the police and state." }
            ],
            "books": ["Criminal Procedure Code by R.V. Kelkar", "Law of Evidence by Batuk Lal"]
        },
        {
            "title": "Arbitrator & Alternative Dispute Resolution Specialist",
            "icon": "🤝",
            "desc": "Resolve high-value commercial and infrastructure disputes out of court through international and domestic arbitration.",
            "targetTraits": { "Communication": 3, "ProblemSolving": 3, "Organized": 2 },
            "phases": [
                { "title": "Phase 1: Law Degree & Commercial Focus", "steps": "Graduate in Law and build expertise in Arbitration and Conciliation Act, 1996 and commercial contracts." },
                { "title": "Phase 2: LL.M / Accreditation", "steps": "Pursue an LL.M in ADR/Commercial Law and earn accreditation from CIArb (Chartered Institute of Arbitrators) or MCIA." },
                { "title": "Phase 3: Institutional Arbitration", "steps": "Represent clients at Singapore International Arbitration Centre (SIAC) or Mumbai Centre for International Arbitration (MCIA)." }
            ],
            "books": ["Law of Arbitration and Conciliation by O.P. Malhotra", "International Commercial Arbitration by Gary Born"]
        }
    ]
};

// =====================================================================
// 3. RANDOM QUESTION SHUFFLER ROUTE (Now serving 8 questions for higher accuracy)
// =====================================================================
app.get('/api/questions', (req, res) => {
    const requestedInterest = req.query.interest; 
    
    // Fallback to TechAI if category is not found
    const pool = questionsDB[requestedInterest] || questionsDB["TechAI"];
    
    // Shuffle the pool randomly
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    
    // Serve 8 questions instead of 5. This increases the accuracy of the 
    // trait profile by giving the matching engine more data points to work with.
    const selectedQuestions = shuffledPool.slice(0, 8);
    
    res.json(selectedQuestions);
});

// =====================================================================
// 4. RULE-BASED MATCHING ENGINE (Instant Calculation)
// =====================================================================
app.post('/api/calculate-result', (req, res) => {
    try {
        const { userTraits, interest } = req.body;

        const candidateCareers = careersDB[interest] || careersDB["TechAI"];

        const scoredCareers = candidateCareers.map(career => {
            let score = 0;
            const targetTraits = career.targetTraits;

            // Mathematical Match: Multiply the user's earned points by the career's required weight
            for (const [trait, targetValue] of Object.entries(targetTraits)) {
                if (userTraits && userTraits[trait]) {
                    score += userTraits[trait] * targetValue;
                }
            }

            // A tiny random fraction ensures that if two careers tie perfectly, 
            // the order shuffles slightly on retakes to prevent staleness.
            const tieBreaker = Math.random() * 0.1;

            return {
                ...career,
                finalScore: score + tieBreaker
            };
        });

        // Sort descending by score
        scoredCareers.sort((a, b) => b.finalScore - a.finalScore);

        // Pick top 4 best matches and strip out the backend scoring data before sending to frontend
        const topMatches = scoredCareers.slice(0, 4).map(({ finalScore, targetTraits, ...rest }) => rest);

        // Instant return
        res.json(topMatches);

    } catch (error) {
        console.error("Matching Error:", error);
        res.status(500).json({ error: "Failed to generate roadmap recommendations." });
    }
});

// Serve PRAXiS main entry point
app.get('/praxis', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`PRAXiS - Fast Rule Engine running on Port ${PORT}`);
});