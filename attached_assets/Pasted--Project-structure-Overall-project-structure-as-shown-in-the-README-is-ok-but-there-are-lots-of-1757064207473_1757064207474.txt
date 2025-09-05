# Project structure:
- Overall project structure as shown in the README is ok, but there are lots of files and folders not shown in the structure, hence not mapped in the project:
  - Move all python files to a specific folder (e.g. "services" or "scripts" folder)
  - Create a "utils" folder where all the generic utilities python scripts will go
  - Add a .env.example with dummy data
  
# Code (python):
- Methods might be too long and could be separated into different functions. 
  For example: ai_extraction_wizard.py > ai_document_extraction() --> It has a very long **try** with a very generic **except**. This means that if there is an exception while executing any part of that code
  it will be very difficult to debug because we will only see `Error in ai_document_extraction: <error text>`. It would be better to split the try into different functions that can be called from elsewhere. 
- Also, in this specific file there are several database operations that would be better in a **database.py** file placed in a "utils" folder and imported into ai_extraction_wizard.py
- Ensure you add a Logger and so that all the errrors are logged correctly, and only use "print()" for **debugging/development phase**
- There are some magic numbers in the code. For example in **line 92 of ai_extraction_wizard.py** you are comparing the length of a list against **2000**. Why? What is that 2000? In these cases it's better to use a **constant** for example **MAX_LENGTH_CONTENT=2000**. You place that constant at the top or inside a specific constants.py file and you call it where you need it. The same goes for other magic numbers you might have
- Use a specific library for the environment variables, it seems like you are storing them as actual environment variables of the system. You should use a library such as python-dotenv and a `.env` file (But never push a `.env` with real credentials to the repository use a `.env.example` with fake credentials instead).
-  **line 172 of ai_extraction_wizard.py** the model (gemini-2.5-pro) would be better placed in a config file (for instance a config.json). That's something you might change over time (using a different model or just an updated version). In the config file you will avoid having to restart the application as you will just update the config file and the code will just read it from there.
-  It seems like you are using return statements to return errors from the python files (such as "return {"error": "Invalid response format after all retries"}"). This would be better inside a log file and in any case, ensure you are not returning too much information to the frontend (for security reasons in case anyone is trying something funny on a **very specific and critical part of your website**)
-  I would advise to put things such as prompts in their own files in their own folder (for example **prompts/csp_data.prompt** for ai_schema_generator.py line 39) and just load them where you need them. That makes it easier to change them if you need to in the future
-  Regular expressions might better be inside a constant (for clearer code and self explainability)
-  (Optional but helpful) Add an explanation at the top of every method such as:
    ```python
    # This method does blablabla
    # params:
    #    - x --> int    : Number of blabla
    #    - y --> string : Name of blabla
    #    - z --> dict   : Dictionary containing blabla
    ```
- (Optional but helpful) Check indentation, it helps for readability and maintainability
  
# Code (typescript):
- server: pretty ok, but check some of the comments for the python code, it also applies here, for example:
  - Use a config file (for instance for server/auth.ts line 40)
  - Avoid magic numbers (for instance in server/chatService.ts)
- client: 
  - pages/Dashboard.tsx you are creating a constant isAdmin. In principle a user cannot reassign a value to this constant but he can re-declare it with another value. So (without having tested it in your page), a non-admin user could go to the browser console and type `const isAdmin=true;` and he would gain access to the admin panel. I would be better to use directly the `user?.role` which in principle should come from the session managed by the backend.