/**
 * Local knowledge base mapping occupations to skills, responsibilities,
 * keywords, and objective templates. No external API needed.
 */

export type OccupationProfile = {
  occupation: string;
  aliases: string[];
  category: string;
  skills: string[];
  responsibilities: string[];
  keywords: string[];
  objectiveTemplates: Record<string, string>;
};

const OCCUPATIONS: OccupationProfile[] = [
  {
    occupation: "Early Childhood Educator",
    aliases: ["daycare teacher", "daycare worker", "ece", "preschool teacher", "childcare worker", "nursery teacher"],
    category: "Childcare & Education",
    skills: ["Child Development", "Classroom Management", "Lesson Planning", "Conflict Resolution", "Time Management", "First Aid & CPR", "Parent Communication", "Activity Planning", "Behaviour Management", "Creative Curriculum Design", "Patience & Empathy", "Child Supervision"],
    responsibilities: [
      "Supervised and engaged groups of children ages 2-5 in structured and unstructured learning activities",
      "Developed and implemented age-appropriate curriculum aligned with early learning frameworks",
      "Maintained a safe, clean, and stimulating classroom environment conducive to learning",
      "Communicated regularly with parents and guardians regarding child progress and developmental milestones",
      "Managed daily routines including meals, nap times, and transitions between activities",
      "Observed and documented children's behaviour, growth, and developmental progress",
      "Collaborated with fellow educators to plan and execute special events and themed programming",
    ],
    keywords: ["childcare", "early learning", "curriculum", "child development", "ECE", "preschool", "classroom"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as an Early Childhood Educator where I can utilize my education, skills, and experience in child development to support the growth and well-being of young learners.",
      "part-time": "Seeking part-time employment in early childhood education where I can apply my skills in child supervision, curriculum planning, and nurturing child development.",
      "contract": "Seeking contract-based opportunities in childcare and early education where I can contribute my expertise in child development and classroom management.",
      "seasonal": "Seeking seasonal employment in childcare or youth programming where I can leverage my skills in activity planning and child supervision.",
    },
  },
  {
    occupation: "Customer Service Representative",
    aliases: ["customer service", "csr", "call center agent", "customer support", "help desk", "service rep"],
    category: "Customer Service",
    skills: ["Active Listening", "Problem Solving", "CRM Software", "Conflict De-escalation", "Multitasking", "Data Entry", "Verbal Communication", "Written Communication", "Time Management", "Product Knowledge", "Empathy", "Attention to Detail"],
    responsibilities: [
      "Handled high volumes of inbound customer inquiries via phone, email, and live chat with professionalism",
      "Resolved customer complaints and escalated complex issues to appropriate departments",
      "Maintained accurate records of customer interactions and transactions in CRM systems",
      "Achieved and consistently exceeded customer satisfaction targets and quality metrics",
      "Provided product and service information to assist customers in making informed decisions",
      "Processed orders, returns, and account modifications with accuracy and efficiency",
    ],
    keywords: ["customer service", "CRM", "call center", "support", "helpdesk", "client relations"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as a Customer Service Representative where I can utilize my strong communication skills and dedication to delivering exceptional client experiences.",
      "part-time": "Seeking part-time customer service opportunities where I can apply my problem-solving abilities and commitment to customer satisfaction.",
      "contract": "Seeking contract-based customer support roles where I can contribute my expertise in client relations and issue resolution.",
      "seasonal": "Seeking seasonal customer service employment where I can leverage my communication skills during peak business periods.",
    },
  },
  {
    occupation: "Warehouse Worker",
    aliases: ["warehouse associate", "warehouse operative", "picker packer", "order picker", "warehouse labourer", "shipping and receiving"],
    category: "Logistics & Warehousing",
    skills: ["Inventory Management", "Forklift Operation", "Order Picking & Packing", "Physical Stamina", "Attention to Detail", "Safety Compliance", "Team Collaboration", "Time Management", "Quality Control", "RF Scanner Operation", "Loading & Unloading", "Organization"],
    responsibilities: [
      "Picked, packed, and prepared orders for shipment with a high degree of accuracy",
      "Operated warehouse equipment including forklifts, pallet jacks, and RF scanners safely",
      "Maintained organized warehouse environment and ensured proper stock rotation",
      "Received and inspected incoming shipments, verifying quantities against purchase orders",
      "Adhered to all workplace health and safety regulations and protocols",
      "Assisted in regular inventory counts and reported discrepancies to supervisors",
    ],
    keywords: ["warehouse", "inventory", "forklift", "shipping", "receiving", "logistics", "picking", "packing"],
    objectiveTemplates: {
      "full-time": "Seeking full-time warehouse employment where I can utilize my organizational skills, attention to detail, and commitment to workplace safety to contribute to efficient operations.",
      "part-time": "Seeking part-time warehouse opportunities where I can apply my experience in order fulfillment and inventory management.",
      "contract": "Seeking contract-based warehouse positions where I can contribute my skills in logistics and materials handling.",
      "seasonal": "Seeking seasonal warehouse employment during peak periods where I can leverage my experience in high-volume order processing.",
    },
  },
  {
    occupation: "Retail Sales Associate",
    aliases: ["retail worker", "sales associate", "cashier", "store clerk", "retail associate", "shop assistant", "sales clerk"],
    category: "Retail & Sales",
    skills: ["Point-of-Sale Systems", "Cash Handling", "Product Merchandising", "Customer Engagement", "Upselling & Cross-selling", "Inventory Replenishment", "Visual Merchandising", "Loss Prevention Awareness", "Team Collaboration", "Conflict Resolution", "Time Management", "Bilingual Communication"],
    responsibilities: [
      "Greeted customers warmly and provided personalized assistance to enhance the shopping experience",
      "Processed sales transactions accurately using point-of-sale systems and handled cash, credit, and debit payments",
      "Maintained organized and visually appealing product displays and store layout",
      "Met and exceeded individual and team sales targets through effective product recommendations",
      "Restocked shelves and managed inventory levels to ensure product availability",
      "Addressed customer concerns and returns professionally, ensuring positive resolutions",
    ],
    keywords: ["retail", "sales", "cashier", "POS", "merchandising", "customer", "store"],
    objectiveTemplates: {
      "full-time": "Seeking full-time retail employment where I can utilize my customer engagement skills and sales experience to drive revenue and deliver outstanding shopping experiences.",
      "part-time": "Seeking part-time retail opportunities where I can apply my skills in customer service, cash handling, and product knowledge.",
      "contract": "Seeking contract-based retail positions where I can contribute my merchandising expertise and customer-first approach.",
      "seasonal": "Seeking seasonal retail employment where I can leverage my sales skills and customer service experience during peak shopping periods.",
    },
  },
  {
    occupation: "Security Guard",
    aliases: ["security officer", "security personnel", "loss prevention", "security", "building security", "site security"],
    category: "Security & Protection",
    skills: ["Surveillance & Monitoring", "Conflict De-escalation", "Access Control", "Incident Reporting", "Emergency Response", "First Aid & CPR", "Physical Fitness", "Attention to Detail", "Communication Skills", "Security Systems Operation", "Crowd Management", "Ontario Security Guard License"],
    responsibilities: [
      "Monitored premises through surveillance systems and regular patrols to ensure safety and security",
      "Controlled access to buildings and facilities, verifying identification and authorization credentials",
      "Responded promptly to security incidents, emergencies, and alarms with appropriate action",
      "Prepared detailed incident reports and maintained accurate security logs",
      "De-escalated confrontational situations using professional communication and conflict resolution techniques",
      "Coordinated with law enforcement and emergency services when required",
    ],
    keywords: ["security", "surveillance", "patrol", "access control", "loss prevention", "safety"],
    objectiveTemplates: {
      "full-time": "Seeking full-time security employment where I can utilize my training in surveillance, access control, and emergency response to maintain safe and secure environments.",
      "part-time": "Seeking part-time security opportunities where I can apply my skills in monitoring, conflict resolution, and incident management.",
      "contract": "Seeking contract-based security positions where I can contribute my experience in facility protection and risk mitigation.",
      "seasonal": "Seeking seasonal security employment where I can leverage my skills in crowd management and event safety.",
    },
  },
  {
    occupation: "Food Service Worker",
    aliases: ["cook", "kitchen helper", "line cook", "prep cook", "barista", "food handler", "restaurant worker", "server", "dishwasher"],
    category: "Food & Hospitality",
    skills: ["Food Safety & Hygiene", "Food Preparation", "Kitchen Equipment Operation", "Time Management Under Pressure", "Team Collaboration", "Inventory Management", "Customer Service", "Menu Knowledge", "Cash Handling", "Multitasking", "Cleaning & Sanitation", "Safe Food Handling Certification"],
    responsibilities: [
      "Prepared and cooked menu items following standardized recipes and food safety guidelines",
      "Maintained a clean and organized kitchen environment in compliance with health regulations",
      "Managed food inventory, rotated stock, and minimized waste through efficient preparation",
      "Operated kitchen equipment safely including grills, fryers, ovens, and slicing machines",
      "Collaborated with front-of-house staff to ensure timely and accurate order delivery",
      "Adhered to all health and safety protocols including WHMIS and Safe Food Handling standards",
    ],
    keywords: ["food service", "kitchen", "cooking", "food safety", "restaurant", "hospitality", "culinary"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment in the food service industry where I can utilize my culinary skills, food safety knowledge, and team collaboration abilities to deliver quality dining experiences.",
      "part-time": "Seeking part-time food service opportunities where I can apply my skills in food preparation, kitchen organization, and customer service.",
      "contract": "Seeking contract-based food service positions where I can contribute my experience in high-volume food preparation and kitchen operations.",
      "seasonal": "Seeking seasonal food service employment where I can leverage my culinary skills and food safety certification.",
    },
  },
  {
    occupation: "Delivery Driver",
    aliases: ["driver", "courier", "delivery person", "truck driver", "van driver", "delivery associate"],
    category: "Transportation & Logistics",
    skills: ["Route Planning & Navigation", "Safe Driving Practices", "Time Management", "Customer Service", "Vehicle Maintenance Awareness", "GPS & Mapping Technology", "Physical Stamina", "Attention to Detail", "Package Handling", "Documentation & Logging", "Clean Driving Record", "Valid G License"],
    responsibilities: [
      "Delivered packages and goods to residential and commercial locations in a timely and professional manner",
      "Planned efficient delivery routes using GPS technology to optimize time and fuel efficiency",
      "Maintained accurate delivery records, obtained signatures, and reported any issues or delays",
      "Performed daily vehicle inspections to ensure safe operation and compliance with regulations",
      "Handled fragile and heavy items with care, ensuring packages arrived in excellent condition",
      "Provided courteous customer service during deliveries and addressed any concerns promptly",
    ],
    keywords: ["delivery", "driving", "courier", "logistics", "transportation", "route planning"],
    objectiveTemplates: {
      "full-time": "Seeking full-time delivery driver employment where I can utilize my safe driving record, route optimization skills, and customer service orientation to ensure reliable and efficient deliveries.",
      "part-time": "Seeking part-time delivery opportunities where I can apply my driving skills and commitment to punctual, professional service.",
      "contract": "Seeking contract-based delivery positions where I can contribute my experience in route planning and dependable package handling.",
      "seasonal": "Seeking seasonal delivery employment during peak periods where I can leverage my driving expertise and strong work ethic.",
    },
  },
  {
    occupation: "Administrative Assistant",
    aliases: ["admin assistant", "office assistant", "receptionist", "office coordinator", "administrative clerk", "office admin", "secretary"],
    category: "Administration & Office",
    skills: ["Microsoft Office Suite", "Data Entry & Management", "Calendar & Schedule Management", "Written & Verbal Communication", "Filing & Organization", "Multi-line Phone Systems", "Meeting Coordination", "Document Preparation", "Confidentiality", "Problem Solving", "Time Management", "Google Workspace"],
    responsibilities: [
      "Managed executive calendars, coordinated meetings, and arranged travel logistics with precision",
      "Prepared professional correspondence, reports, and presentations using Microsoft Office Suite",
      "Maintained organized filing systems for both physical and digital documents",
      "Greeted visitors, answered multi-line phone systems, and directed inquiries to appropriate personnel",
      "Processed incoming and outgoing mail, courier packages, and internal communications",
      "Provided administrative support to multiple departments while maintaining confidentiality of sensitive information",
    ],
    keywords: ["administrative", "office", "reception", "clerical", "scheduling", "Microsoft Office", "data entry"],
    objectiveTemplates: {
      "full-time": "Seeking full-time administrative employment where I can utilize my organizational skills, proficiency in office software, and commitment to efficiency to support team productivity.",
      "part-time": "Seeking part-time administrative opportunities where I can apply my skills in scheduling, data management, and professional communication.",
      "contract": "Seeking contract-based administrative positions where I can contribute my experience in office coordination and document management.",
      "seasonal": "Seeking seasonal administrative support roles where I can leverage my organizational abilities during peak operational periods.",
    },
  },
  {
    occupation: "Personal Support Worker",
    aliases: ["psw", "care aide", "caregiver", "home care worker", "health care aide", "attendant care"],
    category: "Healthcare & Social Services",
    skills: ["Patient Care", "Vital Signs Monitoring", "Mobility Assistance", "Medication Reminders", "Personal Hygiene Assistance", "Empathy & Compassion", "First Aid & CPR", "Documentation & Charting", "Communication Skills", "Infection Control", "Meal Preparation", "WHMIS Certification"],
    responsibilities: [
      "Provided compassionate personal care to clients including bathing, dressing, grooming, and toileting assistance",
      "Monitored and recorded vital signs, reporting changes in health status to supervising healthcare professionals",
      "Assisted clients with mobility, transfers, and range-of-motion exercises using proper body mechanics",
      "Prepared nutritious meals according to dietary requirements and assisted with feeding as needed",
      "Maintained a clean, safe, and comfortable living environment for clients",
      "Documented daily care activities, observations, and incident reports accurately",
    ],
    keywords: ["personal support", "PSW", "healthcare", "patient care", "home care", "nursing", "caregiver"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as a Personal Support Worker where I can utilize my compassionate nature, healthcare training, and dedication to enhancing the quality of life for individuals in my care.",
      "part-time": "Seeking part-time personal support opportunities where I can apply my skills in patient care, health monitoring, and compassionate assistance.",
      "contract": "Seeking contract-based personal support positions where I can contribute my healthcare experience and commitment to dignified, person-centred care.",
      "seasonal": "Seeking seasonal healthcare support roles where I can leverage my patient care skills and certifications.",
    },
  },
  {
    occupation: "Community Outreach Worker",
    aliases: ["outreach worker", "community worker", "social services worker", "case worker", "youth worker", "peer support worker", "shelter worker"],
    category: "Community & Social Services",
    skills: ["Case Management", "Crisis Intervention", "Resource Navigation", "Cultural Competency", "Advocacy", "Active Listening", "Program Facilitation", "Harm Reduction", "Documentation & Reporting", "Conflict Resolution", "Mental Health First Aid", "Community Engagement"],
    responsibilities: [
      "Connected individuals and families with community resources including housing, food banks, and healthcare services",
      "Conducted needs assessments and developed individualized support plans for clients",
      "Facilitated group workshops, information sessions, and community engagement events",
      "Maintained detailed case files and documented client interactions in accordance with agency protocols",
      "Advocated on behalf of clients with government agencies, landlords, and service providers",
      "Built and sustained relationships with community partners, stakeholders, and referral networks",
    ],
    keywords: ["community", "outreach", "social services", "case management", "advocacy", "youth", "shelter", "harm reduction"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment in community outreach where I can utilize my advocacy skills, cultural competency, and passion for empowering individuals to access the resources and support they deserve.",
      "part-time": "Seeking part-time community service opportunities where I can apply my skills in case management, resource navigation, and crisis intervention.",
      "contract": "Seeking contract-based outreach positions where I can contribute my experience in program facilitation and community engagement.",
      "seasonal": "Seeking seasonal community programming roles where I can leverage my skills in event coordination and youth engagement.",
    },
  },
  {
    occupation: "Construction Labourer",
    aliases: ["construction worker", "labourer", "general labourer", "site worker", "builder", "carpenter helper"],
    category: "Construction & Trades",
    skills: ["Physical Stamina & Strength", "Safety Compliance (OHSA)", "Power Tool Operation", "Blueprint Reading Basics", "Material Handling", "Team Collaboration", "Time Management", "Scaffolding Awareness", "Working at Heights Certification", "WHMIS", "Fall Arrest Training", "Concrete & Demolition"],
    responsibilities: [
      "Performed physically demanding tasks including lifting, carrying, and positioning construction materials",
      "Operated hand tools, power tools, and light construction equipment safely and efficiently",
      "Maintained a clean and organized worksite in compliance with OHSA safety standards",
      "Assisted skilled tradespeople with tasks including framing, concrete pouring, and demolition",
      "Participated in regular safety meetings and followed all site-specific safety protocols",
      "Loaded, unloaded, and transported materials to designated areas on the construction site",
    ],
    keywords: ["construction", "labourer", "trades", "safety", "OHSA", "building", "physical"],
    objectiveTemplates: {
      "full-time": "Seeking full-time construction employment where I can utilize my physical capabilities, safety training, and willingness to learn to contribute to successful project completion.",
      "part-time": "Seeking part-time construction opportunities where I can apply my labour skills and safety certifications.",
      "contract": "Seeking contract-based construction positions where I can contribute my experience in material handling and site operations.",
      "seasonal": "Seeking seasonal construction employment where I can leverage my physical stamina and safety training during peak building periods.",
    },
  },
  {
    occupation: "Graphic Designer",
    aliases: ["designer", "visual designer", "creative designer", "digital designer", "brand designer"],
    category: "Creative & Design",
    skills: ["Adobe Creative Suite", "Brand Identity Design", "Typography", "Layout & Composition", "UI/UX Fundamentals", "Print & Digital Design", "Photo Editing", "Illustration", "Colour Theory", "Client Communication", "Project Management", "Figma & Canva"],
    responsibilities: [
      "Conceptualized and produced compelling visual designs for print, digital, and social media platforms",
      "Developed and maintained consistent brand identity guidelines across all marketing collateral",
      "Collaborated with cross-functional teams to translate project requirements into creative visual solutions",
      "Managed multiple design projects simultaneously while meeting quality standards and deadlines",
      "Prepared print-ready files and digital assets optimized for various platforms and specifications",
      "Presented design concepts to stakeholders and incorporated feedback to refine deliverables",
    ],
    keywords: ["graphic design", "Adobe", "brand", "creative", "visual", "Photoshop", "Illustrator", "Figma"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as a Graphic Designer where I can utilize my creative skills, design software proficiency, and visual storytelling abilities to produce impactful brand experiences.",
      "part-time": "Seeking part-time design opportunities where I can apply my expertise in visual communication and brand development.",
      "contract": "Seeking contract-based design positions where I can contribute my creative vision and technical skills to elevate brand presence.",
      "seasonal": "Seeking seasonal design employment where I can leverage my creative expertise for campaign-based projects.",
    },
  },
  {
    occupation: "Web Developer",
    aliases: ["software developer", "programmer", "frontend developer", "backend developer", "full stack developer", "web designer"],
    category: "Technology",
    skills: ["HTML, CSS & JavaScript", "React / Angular / Vue", "Node.js & Express", "Database Management (SQL/NoSQL)", "Version Control (Git)", "Responsive Web Design", "RESTful API Development", "Problem Solving", "Agile Methodology", "Testing & Debugging", "Cloud Services (AWS/Azure)", "TypeScript"],
    responsibilities: [
      "Developed and maintained responsive web applications using modern frontend frameworks and technologies",
      "Collaborated with designers and product managers to translate wireframes into functional user interfaces",
      "Built and integrated RESTful APIs to connect frontend applications with backend services",
      "Implemented version control workflows using Git to manage code repositories and collaborative development",
      "Conducted code reviews, wrote unit tests, and debugged applications to ensure quality and reliability",
      "Optimized application performance, accessibility, and cross-browser compatibility",
    ],
    keywords: ["web development", "JavaScript", "React", "HTML", "CSS", "programming", "software", "coding"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as a Web Developer where I can utilize my programming skills, problem-solving abilities, and passion for building impactful digital solutions.",
      "part-time": "Seeking part-time web development opportunities where I can apply my technical skills and contribute to innovative digital projects.",
      "contract": "Seeking contract-based development positions where I can deliver high-quality web solutions using modern technologies and best practices.",
      "seasonal": "Seeking seasonal technology employment where I can leverage my development skills for project-based initiatives.",
    },
  },
  {
    occupation: "Cleaner",
    aliases: ["janitor", "custodian", "housekeeper", "cleaning staff", "janitorial worker", "sanitation worker", "office cleaner"],
    category: "Maintenance & Cleaning",
    skills: ["Cleaning & Sanitation Techniques", "Chemical Safety (WHMIS)", "Floor Care & Maintenance", "Attention to Detail", "Time Management", "Physical Stamina", "Equipment Operation", "Waste Management", "Organizational Skills", "Reliability & Punctuality", "Health & Safety Compliance", "Independent Work Ethic"],
    responsibilities: [
      "Performed daily cleaning and sanitation of offices, restrooms, common areas, and specialized spaces",
      "Operated and maintained cleaning equipment including floor buffers, vacuums, and carpet extractors",
      "Mixed and applied cleaning solutions safely in accordance with WHMIS regulations",
      "Managed waste collection and disposal, including recycling and hazardous materials handling",
      "Inspected facilities regularly and reported maintenance issues to supervisors promptly",
      "Maintained inventory of cleaning supplies and submitted restocking requests as needed",
    ],
    keywords: ["cleaning", "janitorial", "custodial", "sanitation", "maintenance", "housekeeping"],
    objectiveTemplates: {
      "full-time": "Seeking full-time cleaning employment where I can utilize my attention to detail, safety training, and strong work ethic to maintain clean, healthy, and welcoming environments.",
      "part-time": "Seeking part-time cleaning opportunities where I can apply my sanitation skills and reliability to ensure high standards of cleanliness.",
      "contract": "Seeking contract-based custodial positions where I can contribute my experience in facility maintenance and safety compliance.",
      "seasonal": "Seeking seasonal cleaning employment where I can leverage my efficiency and attention to detail during peak periods.",
    },
  },
  {
    occupation: "Data Entry Clerk",
    aliases: ["data entry", "data processor", "typist", "records clerk", "data clerk"],
    category: "Administration & Office",
    skills: ["Fast & Accurate Typing (60+ WPM)", "Data Entry Software", "Microsoft Excel", "Attention to Detail", "Database Management", "Organizational Skills", "Time Management", "Confidentiality", "Quality Assurance", "Document Scanning", "Record Keeping", "Basic Accounting"],
    responsibilities: [
      "Entered and updated large volumes of data into databases and spreadsheets with a high degree of accuracy",
      "Verified and cross-referenced data against source documents to identify and correct discrepancies",
      "Maintained organized digital and physical filing systems for efficient document retrieval",
      "Generated reports and data summaries for management review using Microsoft Excel",
      "Adhered to data privacy and confidentiality policies when handling sensitive information",
      "Assisted with data migration projects and system updates as required",
    ],
    keywords: ["data entry", "database", "Excel", "typing", "records", "administrative", "clerical"],
    objectiveTemplates: {
      "full-time": "Seeking full-time data entry employment where I can utilize my typing proficiency, attention to detail, and data management skills to support accurate and efficient record keeping.",
      "part-time": "Seeking part-time data entry opportunities where I can apply my organizational skills and accuracy in data processing.",
      "contract": "Seeking contract-based data entry positions where I can contribute my experience in high-volume data processing and quality assurance.",
      "seasonal": "Seeking seasonal data processing employment where I can leverage my typing speed and accuracy during busy periods.",
    },
  },
  {
    occupation: "Landscaper",
    aliases: ["gardener", "groundskeeper", "lawn care", "landscape labourer", "grounds maintenance"],
    category: "Outdoor & Maintenance",
    skills: ["Lawn Care & Maintenance", "Plant Knowledge", "Power Equipment Operation", "Irrigation Systems", "Hardscaping", "Physical Stamina", "Attention to Detail", "Time Management", "Safety Compliance", "Seasonal Planting", "Snow Removal", "Team Collaboration"],
    responsibilities: [
      "Performed lawn maintenance including mowing, edging, trimming, and fertilizing to maintain aesthetic standards",
      "Planted, pruned, and maintained trees, shrubs, flowers, and garden beds according to seasonal schedules",
      "Operated landscaping equipment including mowers, trimmers, blowers, and chain saws safely",
      "Installed and maintained irrigation systems, pathways, and hardscape features",
      "Provided snow removal and winter maintenance services for commercial and residential properties",
      "Ensured all work areas were cleaned and equipment properly stored after each project",
    ],
    keywords: ["landscaping", "gardening", "lawn care", "groundskeeping", "outdoor", "horticulture"],
    objectiveTemplates: {
      "full-time": "Seeking full-time landscaping employment where I can utilize my horticulture knowledge, equipment operation skills, and dedication to creating beautiful outdoor spaces.",
      "part-time": "Seeking part-time landscaping opportunities where I can apply my grounds maintenance skills and attention to detail.",
      "contract": "Seeking contract-based landscaping positions where I can contribute my experience in property maintenance and landscape design.",
      "seasonal": "Seeking seasonal landscaping and snow removal employment where I can leverage my outdoor maintenance expertise.",
    },
  },
  {
    occupation: "Tutor",
    aliases: ["teacher", "instructor", "teaching assistant", "educator", "academic tutor", "substitute teacher"],
    category: "Education & Training",
    skills: ["Subject Matter Expertise", "Lesson Planning", "Differentiated Instruction", "Student Assessment", "Patience & Adaptability", "Communication Skills", "Motivational Techniques", "Classroom Management", "Educational Technology", "Progress Tracking", "Cultural Sensitivity", "Curriculum Development"],
    responsibilities: [
      "Provided individualized and group tutoring sessions to students across various academic subjects",
      "Developed customized lesson plans and learning materials tailored to each student's needs and learning style",
      "Assessed student progress through regular evaluations and adjusted teaching strategies accordingly",
      "Communicated effectively with students, parents, and school staff regarding academic progress",
      "Utilized educational technology and digital tools to enhance learning engagement and outcomes",
      "Created a supportive and encouraging learning environment that fostered academic confidence",
    ],
    keywords: ["tutoring", "teaching", "education", "instruction", "academic", "learning", "curriculum"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment in education where I can utilize my instructional skills, subject expertise, and passion for empowering students to achieve their academic potential.",
      "part-time": "Seeking part-time tutoring opportunities where I can apply my teaching skills and commitment to personalized learning.",
      "contract": "Seeking contract-based educational positions where I can contribute my expertise in curriculum development and student assessment.",
      "seasonal": "Seeking seasonal educational roles in summer programming or after-school tutoring where I can support student success.",
    },
  },
  {
    occupation: "Forklift Operator",
    aliases: ["forklift driver", "material handler", "lift truck operator", "warehouse forklift"],
    category: "Logistics & Warehousing",
    skills: ["Forklift Certification", "Load Balancing & Stacking", "Inventory Management", "Safety Compliance (OHSA)", "RF Scanner Operation", "Physical Stamina", "Attention to Detail", "Team Collaboration", "Pre-Shift Inspections", "Dock Operations", "Time Management", "Problem Solving"],
    responsibilities: [
      "Operated sit-down, stand-up, and reach forklifts to move, load, and unload materials safely",
      "Performed pre-shift vehicle inspections and reported any mechanical issues or safety concerns",
      "Maintained accurate inventory records by scanning and tracking materials using RF technology",
      "Stacked and stored products in designated warehouse locations following proper procedures",
      "Loaded and unloaded delivery trucks at shipping and receiving docks efficiently",
      "Adhered to all workplace safety regulations and participated in regular safety training sessions",
    ],
    keywords: ["forklift", "warehouse", "material handling", "logistics", "shipping", "receiving", "OHSA"],
    objectiveTemplates: {
      "full-time": "Seeking full-time forklift operator employment where I can utilize my certification, safety training, and material handling experience to support efficient warehouse operations.",
      "part-time": "Seeking part-time forklift operation opportunities where I can apply my equipment skills and safety awareness.",
      "contract": "Seeking contract-based forklift positions where I can contribute my certified operation skills and warehouse experience.",
      "seasonal": "Seeking seasonal warehouse operator employment during peak logistics periods where I can leverage my forklift expertise.",
    },
  },
  {
    occupation: "Event Coordinator",
    aliases: ["event planner", "events manager", "event organizer", "conference coordinator", "program coordinator"],
    category: "Events & Communications",
    skills: ["Event Planning & Logistics", "Vendor Management", "Budget Tracking", "Project Management", "Communication Skills", "Problem Solving Under Pressure", "Time Management", "Social Media Marketing", "Volunteer Coordination", "Negotiation", "Attention to Detail", "Public Speaking"],
    responsibilities: [
      "Planned and executed events from concept to completion including conferences, fundraisers, and community gatherings",
      "Coordinated with vendors, caterers, and venue staff to ensure seamless event logistics",
      "Developed and managed event budgets, tracking expenses and negotiating contracts",
      "Recruited, trained, and supervised event volunteers and support staff",
      "Created promotional materials and managed social media campaigns to drive event attendance",
      "Conducted post-event evaluations to assess outcomes and identify areas for improvement",
    ],
    keywords: ["event planning", "coordination", "logistics", "vendor management", "fundraising", "programming"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as an Event Coordinator where I can utilize my planning skills, vendor management experience, and creative vision to deliver memorable and impactful events.",
      "part-time": "Seeking part-time event coordination opportunities where I can apply my organizational and logistical skills.",
      "contract": "Seeking contract-based event planning positions where I can contribute my expertise in end-to-end event management.",
      "seasonal": "Seeking seasonal event coordination roles where I can leverage my planning skills for festivals, conferences, and community events.",
    },
  },
  {
    occupation: "General Labourer",
    aliases: ["labourer", "general worker", "factory worker", "production worker", "manual labourer", "assembly worker"],
    category: "General Labour",
    skills: ["Physical Stamina & Endurance", "Reliability & Punctuality", "Safety Awareness", "Team Collaboration", "Following Instructions", "Basic Tool Operation", "Material Handling", "Quality Control", "Time Management", "Adaptability", "WHMIS", "Working at Heights"],
    responsibilities: [
      "Performed a variety of physical tasks including lifting, carrying, sorting, and assembling materials",
      "Followed supervisor instructions and standard operating procedures accurately and consistently",
      "Maintained a clean, safe, and organized work environment throughout each shift",
      "Operated basic hand tools and equipment safely in accordance with workplace safety protocols",
      "Participated in quality control checks to ensure products met established standards",
      "Demonstrated flexibility by adapting to changing task assignments and work priorities",
    ],
    keywords: ["labour", "general", "physical", "factory", "production", "manufacturing", "assembly"],
    objectiveTemplates: {
      "full-time": "Seeking full-time employment as a General Labourer where I can utilize my strong work ethic, physical capabilities, and dedication to safety to contribute to productive operations.",
      "part-time": "Seeking part-time labourer opportunities where I can apply my reliability and willingness to take on diverse physical tasks.",
      "contract": "Seeking contract-based labour positions where I can contribute my adaptability and commitment to quality work.",
      "seasonal": "Seeking seasonal labour employment where I can leverage my physical stamina and team collaboration skills.",
    },
  },
];

/**
 * Find an occupation profile matching a user query.
 * Returns the best match or null.
 */
export function findOccupation(query: string): OccupationProfile | null {
  if (!query || query.trim().length < 2) return null;
  const q = query.toLowerCase().trim();

  // Exact match on occupation name
  const exact = OCCUPATIONS.find((o) => o.occupation.toLowerCase() === q);
  if (exact) return exact;

  // Exact match on alias
  const aliasExact = OCCUPATIONS.find((o) => o.aliases.some((a) => a === q));
  if (aliasExact) return aliasExact;

  // Substring match
  const substring = OCCUPATIONS.find(
    (o) =>
      o.occupation.toLowerCase().includes(q) ||
      o.aliases.some((a) => a.includes(q)),
  );
  if (substring) return substring;

  // Word overlap scoring
  const queryWords = q.split(/\s+/).filter((w) => w.length > 2);
  let best: { profile: OccupationProfile; score: number } | null = null;
  for (const o of OCCUPATIONS) {
    const allText = [o.occupation, ...o.aliases, o.category].join(" ").toLowerCase();
    const matches = queryWords.filter((w) => allText.includes(w)).length;
    const score = matches / Math.max(queryWords.length, 1);
    if (score > 0.3 && (!best || score > best.score)) {
      best = { profile: o, score };
    }
  }
  return best?.profile || null;
}

/**
 * Search occupations for autocomplete.
 * Returns top matches sorted by relevance.
 */
export function searchOccupations(query: string, limit = 5): OccupationProfile[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();

  type Scored = { profile: OccupationProfile; score: number };
  const scored: Scored[] = [];

  for (const o of OCCUPATIONS) {
    let score = 0;
    if (o.occupation.toLowerCase() === q) score = 100;
    else if (o.aliases.some((a) => a === q)) score = 90;
    else if (o.occupation.toLowerCase().includes(q)) score = 70;
    else if (o.aliases.some((a) => a.includes(q))) score = 65;
    else {
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const allText = [o.occupation, ...o.aliases, o.category].join(" ").toLowerCase();
      const matches = words.filter((w) => allText.includes(w)).length;
      score = (matches / Math.max(words.length, 1)) * 50;
    }
    if (score > 15) scored.push({ profile: o, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.profile);
}

/**
 * Get all unique occupation categories.
 */
export function getAllCategories(): string[] {
  return [...new Set(OCCUPATIONS.map((o) => o.category))].sort();
}

/**
 * Get occupations by category.
 */
export function getOccupationsByCategory(category: string): OccupationProfile[] {
  return OCCUPATIONS.filter((o) => o.category === category);
}

/**
 * Get all occupations.
 */
export function getAllOccupations(): OccupationProfile[] {
  return OCCUPATIONS;
}
