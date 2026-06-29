This will be the form that hackers use to apply.

## Requirements

- Use shadcn components for building the form UI
- Use React Hook Form for form state management and validation
- Allow users to save progress locally and return later to complete the application
- Validate submissions both in the browser and on the server for correctness
- ** For the resume upload, use a dummy function for now. We will set up S3 later.

## Design

- Any simple form design would suffice
- Example from shadcn docs https://ui.shadcn.com/docs/forms/react-hook-form#complex-forms
    
    ![Screenshot 2026-03-08 at 6.15.35 PM.png](attachment:b798e4b7-33c0-4637-a0c6-d4a815b480d0:Screenshot_2026-03-08_at_6.15.35_PM.png)
    
- Additional features like partitioning the form into paged sections or fancy UI elements (e.g., map for location input) would be fun, but beyond MVP

## Questions

**Personal Information**

- Age: Number input (min: 18)
- Gender: Single-select dropdown
    - Male
    - Female
    - Other (please describe)
- Ethnicity: Single-select dropdown
    - American Indian or Alaska Native
    - Asian
    - Black or African American
    - Hispanic or Latino / Latina / Latinx
    - Middle Eastern or North African
    - Native Hawaiian or Pacific Islander
    - White
    - Multiracial (please describe)

**Academic Information**

- University: Single-select dropdown
    - Find a list of universities
    - Other (please describe)
- Country: Single-select dropdown
    - Find a list of countries
    - Other (describe)
- Degree: Single-select dropdown
    - High School
    - Associate's
    - Bachelor's
    - Master's
    - PhD
    - Other (please describe)
- Graduation Year: Number input (min: 2026)
- Number of Previous Hackathons: Number input
- Major(s): Single-select dropdown
    - Computer Science
    - Computer Engineering
    - Electrical Engineering
    - Data Science
    - Statistics
    - Mathematics
    - Business
    - Other or multiple majors (please describe)
- Resume: PDF File upload

**Essays** (min/max character limits apply)

- Why do you want to attend MHacks?
- Describe a technical challenge you've faced and how you solved it.
- Tell us about a project you're proud of.
- Anything else you'd like us to know? (optional)

**Logistics**

- Transportation Type: Single-select dropdown
    - Driving
    - Flying
    - Bus
    - Train
    - Local
- Where Are You Coming From?: Text input
- Shirt Size: Single-select dropdown
    - XS
    - S
    - M
    - L
    - XL
    - XXL
- Do you have any allergies or dietary restrictions?: Checkbox
    - When checked provide textbox with “Please describe”
- Will you require travel reimbursement to attend? Yes / No
- If yes: If travel reimbursement cannot be provided, would you still be interested in attending MHacks?

**Socials**

- GitHub (optional): URL input
- LinkedIn (optional): URL input
- Personal Site (optional): URL input

**Communications**

- Did you follow us on Instagram (@mhacks_)? (optional): Checkbox

**MLH & Sponsor Agreements**

- I have read and agree to the MLH Code of Conduct: Checkbox (must be checked)
- I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy. I further agree to the terms of both the MLH Contest Terms and Conditions and the MLH Privacy Policy: Checkbox (must be checked)
- I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements: Checkbox (must be checked)
- I agree to receive emails from event sponsors about relevant opportunities and updates: Checkbox (optional)

from amy: make sure all are present: https://guide.mlh.io/general-information/managing-registrations/registrations
