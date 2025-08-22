from objectStorage import objectStorageClient
import sys

# Test URL
url = "https://storage.googleapis.com/replit-objstore-b80b8c29-8d49-411f-b6d6-1bba57bed40d/.private/sample-files/2dfbfa5f-0500-46e4-be85-f64ee25347f1"

try:
    # Parse URL
    from urllib.parse import urlparse
    parsed = urlparse(url)
    path_parts = parsed.path.split('/')
    bucket_name = path_parts[1]
    object_name = '/'.join(path_parts[2:])
    
    print(f"Bucket: {bucket_name}")
    print(f"Object: {object_name}")
    
    # Get the file
    bucket = objectStorageClient.bucket(bucket_name)
    file = bucket.file(object_name)
    
    # Check if exists
    exists = file.exists()
    print(f"File exists: {exists}")
    
    if exists:
        # Download content
        content = file.download_as_bytes()
        print(f"Downloaded {len(content)} bytes")
        
        # Save to test file
        with open('test_download.xlsx', 'wb') as f:
            f.write(content)
        print("Saved to test_download.xlsx")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
