-- Story 4.8: public officer sign-up request; the admin needs to see which unit the applicant belongs to.
ALTER TABLE core_schema.users
    ADD COLUMN IF NOT EXISTS department_unit VARCHAR(150);
