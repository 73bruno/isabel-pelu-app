import csv
import re
import os

# Configuration
INPUT_FILE = 'Clientes.csv'
OUTPUT_FILE = 'google_contacts_import.csv'

def clean_phone(phone_str):
    if not phone_str:
        return None
    # Remove non-digit characters
    cleaned = re.sub(r'\D', '', phone_str)
    if not cleaned:
        return None
    return cleaned

def get_phone_type(phone_str):
    if not phone_str:
        return 'Other'
    if phone_str.startswith('6') or phone_str.startswith('7'):
        return 'Mobile'
    return 'Home'

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    print(f"Reading {INPUT_FILE}...")
    
    contacts = []
    
    # Needs to handle some potentially messy CSV encoding
    # latin-1 is common for older MDB exports in Spanish systems
    encoding = 'utf-8' 
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            f.read(1000)
    except UnicodeDecodeError:
        encoding = 'latin-1'
    
    print(f"Detected encoding strategy: {encoding}")

    with open(INPUT_FILE, 'r', encoding=encoding, errors='replace') as csvfile:
        # It seems the CSV dialect might be slightly custom, but let's try standard first
        # based on the file view, it uses double quotes and comma delimiter.
        reader = csv.DictReader(csvfile)
        
        for row in reader:
            # Basic validation
            name = row.get('Nombre', '').strip()
            if not name:
                continue
                
            # Extract Phones
            p1_raw = row.get('Telefono1', '').strip()
            p2_raw = row.get('Telefono2', '').strip()
            
            p1_clean = clean_phone(p1_raw)
            p2_clean = clean_phone(p2_raw)
            
            # Extract Email
            email = row.get('Email', '').strip()
            
            # Extract Notes
            notes = row.get('Notas', '').strip()
            
            # Build Google Contact
            contact = {
                'Name': name,
                'Given Name': name, # Google often uses Name, but explicit maps help
                'Notes': notes,
                'E-mail 1 - Type': 'Work' if email else '',
                'E-mail 1 - Value': email,
                'Phone 1 - Type': get_phone_type(p1_clean) if p1_clean else '',
                'Phone 1 - Value': p1_clean if p1_clean else '',
                'Phone 2 - Type': get_phone_type(p2_clean) if p2_clean else '',
                'Phone 2 - Value': p2_clean if p2_clean else '',
            }
            
            # Only add if we have at least a phone or email or notes? 
            # Usually we want valid contacts. Let's keep if we have a Name.
            contacts.append(contact)

    print(f"Processed {len(contacts)} contacts.")
    
    # Write Google Contacts CSV
    # Standard Google Headers (subset relevant to us)
    fieldnames = [
        'Name', 'Given Name', 'Additional Name', 'Family Name', 'Yomi Name', 
        'Given Name Yomi', 'Additional Name Yomi', 'Family Name Yomi', 'Name Prefix', 
        'Name Suffix', 'Initials', 'Nickname', 'Short Name', 'Maiden Name', 'Birthday', 
        'Gender', 'Location', 'Billing Information', 'Directory Server', 'Mileage', 
        'Occupation', 'Hobby', 'Sensitivity', 'Priority', 'Subject', 'Notes', 
        'Language', 'Photo', 'Group Membership', 'E-mail 1 - Type', 'E-mail 1 - Value', 
        'Phone 1 - Type', 'Phone 1 - Value', 'Phone 2 - Type', 'Phone 2 - Value'
    ]
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for c in contacts:
            # We need to map our simple dict to the full headers
            row_out = {k: '' for k in fieldnames}
            row_out.update(c)
            writer.writerow(row_out)
            
    print(f"Successfully created {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
